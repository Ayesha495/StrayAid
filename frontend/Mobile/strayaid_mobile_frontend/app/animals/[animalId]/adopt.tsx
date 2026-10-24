import { Feather, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Href, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSession } from "../../../hooks/useSession";
import { SessionExpiredError } from "../../../services/apiClient";
import {
  AdoptionError,
  AdoptionForm,
  applyToAdopt,
  getAdoptableAnimals,
  getAnimal,
  getCurrentUser,
  MobileAnimal,
} from "../../../services/mobileContentService";
import { colors, fonts } from "../../../theme/tokens";

// Stitch screen 14: Adoption application. Stitch draws step 1 (applicant); steps 2-4
// (home & lifestyle, why adopt, review) follow the same look.

type Draft = {
  full_name: string;
  phone: string;
  home_type: AdoptionForm["home_type"] | null;
  has_other_pets: boolean | null;
  city: string;
  ownership: AdoptionForm["ownership"] | null;
  landlord_allows_pets: boolean | null;
  household_size: number;
  has_children: boolean | null;
  hours_alone: number | null;
  experience: AdoptionForm["experience"] | null;
  reason: string;
  care_plan: string;
  agrees_home_visit: boolean;
  agrees_return_policy: boolean;
};

const EMPTY: Draft = {
  full_name: "",
  phone: "",
  home_type: null,
  has_other_pets: null,
  city: "",
  ownership: null,
  landlord_allows_pets: null,
  household_size: 1,
  has_children: null,
  hours_alone: null,
  experience: null,
  reason: "",
  care_plan: "",
  agrees_home_visit: false,
  agrees_return_policy: false,
};

const STEPS = [
  { title: "Applicant Information", subtitle: "Please provide accurate personal details for verification." },
  { title: "Home & Lifestyle", subtitle: "Help the organization picture the home you're offering." },
  { title: "Why Adopt", subtitle: "Tell the organization about you and how you'll care for your new pet." },
  { title: "Review & Submit", subtitle: "Check your answers before sending the application." },
];

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
const HOME_TYPES: { value: AdoptionForm["home_type"]; label: string; icon: IconName }[] = [
  { value: "apartment", label: "Apartment", icon: "office-building-outline" },
  { value: "house", label: "House", icon: "home-outline" },
  { value: "other", label: "Other", icon: "dots-horizontal-circle-outline" },
];
const HOURS: { value: number; label: string }[] = [
  { value: 1, label: "Under 2h" },
  { value: 3, label: "2–4h" },
  { value: 6, label: "4–8h" },
  { value: 9, label: "8h+" },
];
const EXPERIENCE: { value: AdoptionForm["experience"]; label: string; icon: IconName }[] = [
  { value: "first_time", label: "First pet", icon: "sprout-outline" },
  { value: "some", label: "Had pets", icon: "paw-outline" },
  { value: "experienced", label: "Experienced", icon: "star-outline" },
];
const HOME_LABEL = Object.fromEntries(HOME_TYPES.map((item) => [item.value, item.label]));
const EXPERIENCE_LABEL: Record<string, string> = {
  first_time: "First pet",
  some: "Had pets before",
  experienced: "Very experienced",
};
const HOURS_LABEL = Object.fromEntries(HOURS.map((item) => [item.value, item.label]));

// Which step each server-side field lives on, to jump back to it.
const FIELD_STEP: Record<string, number> = {
  full_name: 0, phone: 0, home_type: 0, has_other_pets: 0,
  city: 1, ownership: 1, landlord_allows_pets: 1, household_size: 1, has_children: 1, hours_alone: 1, experience: 1,
  reason: 2, care_plan: 2, agreements: 2,
};

const capitalize = (value?: string) => (value ? value[0].toUpperCase() + value.slice(1) : "");
const yesNo = (value: boolean | null) => (value == null ? "—" : value ? "Yes" : "No");

function validate(step: number, draft: Draft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (step === 0) {
    if (draft.full_name.trim().length < 3) errors.full_name = "Enter your full name.";
    const digits = draft.phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) errors.phone = "Enter a valid phone number, e.g. +92 300 1234567.";
    if (!draft.home_type) errors.home_type = "Choose your home type.";
    if (draft.has_other_pets == null) errors.has_other_pets = "Tell us if you have other pets.";
  }
  if (step === 1) {
    if (!draft.city.trim()) errors.city = "Enter the city you live in.";
    if (!draft.ownership) errors.ownership = "Choose whether you own or rent.";
    if (draft.ownership === "rent" && draft.landlord_allows_pets == null) errors.landlord_allows_pets = "Say whether pets are allowed.";
    if (draft.has_children == null) errors.has_children = "Tell us if there are children at home.";
    if (draft.hours_alone == null) errors.hours_alone = "Choose how long your pet would be alone.";
    if (!draft.experience) errors.experience = "Choose your experience with pets.";
  }
  if (step === 2) {
    if (draft.reason.trim().length < 20) errors.reason = "Tell the organization a little more (at least 20 characters).";
    if (!draft.agrees_home_visit || !draft.agrees_return_policy) errors.agreements = "Please accept both promises to apply.";
  }
  return errors;
}

function Stepper({ step }: { step: number }) {
  return (
    <View style={styles.stepper} accessible accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
      {STEPS.map((item, index) => (
        <View key={item.title} style={styles.stepItem}>
          {index > 0 && <View style={[styles.stepLine, index <= step && styles.stepLineDone]} />}
          <View style={[styles.stepCircle, index === step && styles.stepActive, index < step && styles.stepDone]}>
            {index < step ? (
              <MaterialIcons name="check" size={15} color={colors.onPrimary} />
            ) : (
              <Text style={[styles.stepNumber, index === step && styles.stepNumberActive]}>{index + 1}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

function FieldError({ message }: { message?: string }) {
  return message ? <Text style={styles.fieldError}>{message}</Text> : null;
}

// Outline cards (home type, experience) and filled yes/no buttons, as on the design.
function Choice<T extends string | number | boolean>({
  options,
  value,
  onChange,
  solid,
}: {
  options: { value: T; label: string; icon?: IconName }[];
  value: T | null;
  onChange: (value: T) => void;
  solid?: boolean;
}) {
  return (
    <View style={[styles.choiceRow, solid && styles.choiceRowSolid]} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.choice,
              solid
                ? selected
                  ? styles.choiceSolidOn
                  : styles.choiceIdle
                : selected
                ? styles.choiceOutlineOn
                : styles.choiceIdle,
            ]}
          >
            {solid && selected && <MaterialIcons name="check" size={16} color={colors.onPrimary} />}
            {!solid && option.icon && (
              <MaterialCommunityIcons name={option.icon} size={16} color={selected ? colors.primary : "#94A3B8"} />
            )}
            <Text
              style={[
                styles.choiceText,
                solid ? (selected ? styles.choiceSolidText : styles.choiceSolidIdleText) : selected && styles.choiceOutlineText,
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const YES_NO: { value: boolean; label: string }[] = [
  { value: true, label: "Yes" },
  { value: false, label: "No" },
];

function Agreement({ checked, onToggle, text }: { checked: boolean; onToggle: () => void; text: string }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={[styles.agreement, checked && styles.agreementOn]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked && <MaterialIcons name="check" size={14} color={colors.onPrimary} />}
      </View>
      <Text style={styles.agreementText}>{text}</Text>
    </Pressable>
  );
}

function ReviewSection({ title, rows, onEdit }: { title: string; rows: [string, string][]; onEdit: () => void }) {
  return (
    <View style={styles.review}>
      <View style={styles.reviewHeader}>
        <Text style={styles.reviewTitle}>{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${title}`} onPress={onEdit} hitSlop={8}>
          <Text style={styles.reviewEdit}>Edit</Text>
        </Pressable>
      </View>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>{label}</Text>
          <Text style={styles.reviewValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

export default function AdoptionApplicationScreen() {
  const { animalId } = useLocalSearchParams<{ animalId: string }>();
  const { isSignedIn, isChecking } = useSession();
  const [animal, setAnimal] = useState<MobileAnimal | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [picker, setPicker] = useState<MobileAnimal[] | null>(null);
  const scroll = useRef<ScrollView>(null);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string] && !(key.startsWith("agrees") && current.agreements)) return current;
      const next = { ...current };
      delete next[key as string];
      if (key.startsWith("agrees")) delete next.agreements;
      return next;
    });
    setFormError(null);
  };

  useEffect(() => {
    if (!isChecking && !isSignedIn) router.push("/auth-sheet");
  }, [isChecking, isSignedIn]);

  useEffect(() => {
    getAnimal(animalId)
      .then((data) => {
        setAnimal(data);
        setLoadError(null);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "We couldn't load this animal."));
  }, [animalId]);

  // Start from the account's name, and the city the organization is in.
  useEffect(() => {
    if (!isSignedIn) return;
    getCurrentUser()
      .then((user) => {
        const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
        setDraft((current) => (current.full_name ? current : { ...current, full_name: name }));
      })
      .catch(() => null);
  }, [isSignedIn]);
  useEffect(() => {
    const city = animal?.organization.city;
    if (city) setDraft((current) => (current.city ? current : { ...current, city }));
  }, [animal?.organization.city]);

  const touched = JSON.stringify({ ...draft, full_name: "", city: "" }) !== JSON.stringify({ ...EMPTY, full_name: "", city: "" });

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(`/animals/${animalId}` as Href);
  }, [animalId]);

  const goBack = useCallback(() => {
    if (sent) {
      leave();
      return true;
    }
    if (step > 0) {
      setStep(step - 1);
      setErrors({});
      return true;
    }
    if (!touched) {
      leave();
      return true;
    }
    Alert.alert("Leave your application?", "Your answers won't be saved.", [
      { text: "Keep going", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: leave },
    ]);
    return true;
  }, [leave, sent, step, touched]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", goBack);
    return () => subscription.remove();
  }, [goBack]);

  const next = async () => {
    if (step < 3) {
      const found = validate(step, draft);
      setErrors(found);
      if (Object.keys(found).length) return;
      setStep(step + 1);
      scroll.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    if (!animal || submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await applyToAdopt(animal.id, {
        ...(draft as AdoptionForm),
        full_name: draft.full_name.trim(),
        landlord_allows_pets: draft.ownership === "rent" ? draft.landlord_allows_pets : null,
      });
      setSent(true);
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        router.push("/auth-sheet");
        setFormError("Sign in again, then tap Submit. Your answers are kept.");
      } else if (err instanceof AdoptionError && Object.keys(err.fields).length) {
        const firstStep = Math.min(...Object.keys(err.fields).map((field) => FIELD_STEP[field] ?? 3));
        setErrors(err.fields);
        setStep(firstStep);
        setFormError(err.message);
      } else {
        setFormError(err instanceof Error ? err.message : "We couldn't send your application.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openPicker = async () => {
    setPicker([]);
    try {
      setPicker((await getAdoptableAnimals()).filter((item) => !item.my_application));
    } catch {
      setPicker(null);
      Alert.alert("Couldn't load animals", "Please check your connection and try again.");
    }
  };

  const chooseAnimal = (item: MobileAnimal) => {
    setPicker(null);
    if (item.id !== animal?.id) router.setParams({ animalId: String(item.id) });
  };

  const summary = animal
    ? [capitalize(animal.species), animal.vaccinated && "Vaccinated", animal.age != null && `${animal.age} ${animal.age === 1 ? "year" : "years"}`]
        .filter(Boolean)
        .join(" • ")
    : "";
  const unavailable = animal && (animal.status !== "adoptable" || !!animal.my_application);

  if (sent && animal) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View style={styles.sent}>
          <View style={styles.sentBadge}>
            <MaterialIcons name="check" size={44} color={colors.onPrimary} />
          </View>
          <Text style={styles.sentTitle} accessibilityRole="header">
            Application sent!
          </Text>
          <Text style={styles.sentBody}>
            {animal.organization.name} will review your application for {animal.name} and contact you on {draft.phone.trim()}.
            We&apos;ll also let you know here when it&apos;s been reviewed.
          </Text>
        </View>
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" onPress={leave} style={({ pressed }) => [styles.next, pressed && styles.nextPressed]}>
            <Text style={styles.nextText}>Back to {animal.name}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)/home")} style={styles.secondaryLink}>
            <Text style={styles.secondaryLinkText}>Back to Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={step > 0 ? "Previous step" : "Go back"}
          onPress={goBack}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <MaterialIcons name="chevron-left" size={28} color="#1E293B" />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Adoption Application
        </Text>
        <View style={styles.navSpacer} />
      </View>

      {!animal ? (
        <View style={styles.centered}>
          {loadError ? <Text style={styles.loadError}>{loadError}</Text> : <ActivityIndicator color={colors.primary} />}
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Stepper step={step} />
            <View style={styles.heading}>
              <Text style={styles.stepTitle}>{STEPS[step].title}</Text>
              <Text style={styles.stepSubtitle}>{STEPS[step].subtitle}</Text>
            </View>

            {unavailable && (
              <View style={styles.notice}>
                <MaterialIcons name="info-outline" size={16} color="#B7791F" />
                <Text style={styles.noticeText}>
                  {animal.my_application
                    ? `You've already applied to adopt ${animal.name}.`
                    : `${animal.name} isn't up for adoption right now.`}{" "}
                  Choose another animal with “Change”.
                </Text>
              </View>
            )}

            {step === 0 && (
              <View style={styles.form}>
                <View style={styles.field}>
                  <Label>Full name</Label>
                  <TextInput
                    style={[styles.input, !!errors.full_name && styles.inputInvalid]}
                    value={draft.full_name}
                    onChangeText={(value) => update("full_name", value)}
                    placeholder="Enter your full name"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                  />
                  <FieldError message={errors.full_name} />
                </View>
                <View style={styles.field}>
                  <Label>Phone number</Label>
                  <TextInput
                    style={[styles.input, styles.phone, !!errors.phone && styles.inputInvalid]}
                    value={draft.phone}
                    onChangeText={(value) => update("phone", value)}
                    placeholder="+92 300 0000000"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                  />
                  <FieldError message={errors.phone} />
                </View>
                <View style={[styles.field, styles.choiceField]}>
                  <Label>Home Type</Label>
                  <Choice options={HOME_TYPES} value={draft.home_type} onChange={(value) => update("home_type", value)} />
                  <FieldError message={errors.home_type} />
                </View>
                <View style={[styles.field, styles.choiceField]}>
                  <Label>Other pets?</Label>
                  <Choice solid options={YES_NO} value={draft.has_other_pets} onChange={(value) => update("has_other_pets", value)} />
                  <FieldError message={errors.has_other_pets} />
                </View>
              </View>
            )}

            {step === 1 && (
              <View style={styles.form}>
                <View style={styles.field}>
                  <Label>City</Label>
                  <TextInput
                    style={[styles.input, !!errors.city && styles.inputInvalid]}
                    value={draft.city}
                    onChangeText={(value) => update("city", value)}
                    placeholder="e.g. Islamabad"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="words"
                  />
                  <FieldError message={errors.city} />
                </View>
                <View style={[styles.field, styles.choiceField]}>
                  <Label>Do you own or rent your home?</Label>
                  <Choice
                    solid
                    options={[
                      { value: "own", label: "Own" },
                      { value: "rent", label: "Rent" },
                    ]}
                    value={draft.ownership}
                    onChange={(value) => update("ownership", value as Draft["ownership"])}
                  />
                  <FieldError message={errors.ownership} />
                </View>
                {draft.ownership === "rent" && (
                  <View style={[styles.field, styles.choiceField]}>
                    <Label>Does your landlord allow pets?</Label>
                    <Choice solid options={YES_NO} value={draft.landlord_allows_pets} onChange={(value) => update("landlord_allows_pets", value)} />
                    <FieldError message={errors.landlord_allows_pets} />
                  </View>
                )}
                <View style={[styles.field, styles.choiceField]}>
                  <Label>People living in your home</Label>
                  <View style={styles.counter}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="One less person"
                      disabled={draft.household_size <= 1}
                      onPress={() => update("household_size", Math.max(1, draft.household_size - 1))}
                      style={[styles.counterButton, draft.household_size <= 1 && styles.counterDisabled]}
                    >
                      <MaterialIcons name="remove" size={20} color={colors.primary} />
                    </Pressable>
                    <Text style={styles.counterValue} accessibilityLiveRegion="polite">
                      {draft.household_size}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="One more person"
                      disabled={draft.household_size >= 30}
                      onPress={() => update("household_size", Math.min(30, draft.household_size + 1))}
                      style={styles.counterButton}
                    >
                      <MaterialIcons name="add" size={20} color={colors.primary} />
                    </Pressable>
                  </View>
                </View>
                <View style={[styles.field, styles.choiceField]}>
                  <Label>Children at home?</Label>
                  <Choice solid options={YES_NO} value={draft.has_children} onChange={(value) => update("has_children", value)} />
                  <FieldError message={errors.has_children} />
                </View>
                <View style={[styles.field, styles.choiceField]}>
                  <Label>{`How long would ${animal.name} be alone each day?`}</Label>
                  <Choice options={HOURS} value={draft.hours_alone} onChange={(value) => update("hours_alone", value)} />
                  <FieldError message={errors.hours_alone} />
                </View>
                <View style={[styles.field, styles.choiceField]}>
                  <Label>Experience with pets</Label>
                  <Choice options={EXPERIENCE} value={draft.experience} onChange={(value) => update("experience", value)} />
                  <FieldError message={errors.experience} />
                </View>
              </View>
            )}

            {step === 2 && (
              <View style={styles.form}>
                <View style={styles.field}>
                  <Label>{`Why do you want to adopt ${animal.name}?`}</Label>
                  <TextInput
                    style={[styles.input, styles.textArea, !!errors.reason && styles.inputInvalid]}
                    value={draft.reason}
                    onChangeText={(value) => update("reason", value)}
                    placeholder="Your home, routine and what you can offer…"
                    placeholderTextColor="#94A3B8"
                    multiline
                    textAlignVertical="top"
                    maxLength={1000}
                  />
                  <View style={styles.counterRow}>
                    <FieldError message={errors.reason} />
                    <Text style={styles.charCount}>{draft.reason.trim().length}/1000</Text>
                  </View>
                </View>
                <View style={styles.field}>
                  <Label>{`Who will care for ${animal.name} when you're away? (optional)`}</Label>
                  <TextInput
                    style={[styles.input, styles.textAreaSmall]}
                    value={draft.care_plan}
                    onChangeText={(value) => update("care_plan", value)}
                    placeholder="Family, a neighbour, a pet sitter…"
                    placeholderTextColor="#94A3B8"
                    multiline
                    textAlignVertical="top"
                    maxLength={500}
                  />
                </View>
                <View style={styles.agreements}>
                  <Agreement
                    checked={draft.agrees_home_visit}
                    onToggle={() => update("agrees_home_visit", !draft.agrees_home_visit)}
                    text={`I agree to a home visit from ${animal.organization.name} before adopting.`}
                  />
                  <Agreement
                    checked={draft.agrees_return_policy}
                    onToggle={() => update("agrees_return_policy", !draft.agrees_return_policy)}
                    text={`If I ever can't keep ${animal.name}, I'll return them to ${animal.organization.name}, never abandon them.`}
                  />
                  <FieldError message={errors.agreements} />
                </View>
              </View>
            )}

            {step === 3 && (
              <View style={styles.form}>
                <ReviewSection
                  title="Applicant"
                  onEdit={() => setStep(0)}
                  rows={[
                    ["Full name", draft.full_name.trim()],
                    ["Phone", draft.phone.trim()],
                    ["Home type", draft.home_type ? HOME_LABEL[draft.home_type] : "—"],
                    ["Other pets", yesNo(draft.has_other_pets)],
                  ]}
                />
                <ReviewSection
                  title="Home & lifestyle"
                  onEdit={() => setStep(1)}
                  rows={[
                    ["City", draft.city.trim()],
                    ["Home", draft.ownership === "rent" ? `Rented${draft.landlord_allows_pets ? ", pets allowed" : ", pets not allowed"}` : "Owned"],
                    ["People at home", String(draft.household_size)],
                    ["Children", yesNo(draft.has_children)],
                    ["Alone each day", draft.hours_alone != null ? HOURS_LABEL[draft.hours_alone] : "—"],
                    ["Experience", draft.experience ? EXPERIENCE_LABEL[draft.experience] : "—"],
                  ]}
                />
                <ReviewSection
                  title="Why adopt"
                  onEdit={() => setStep(2)}
                  rows={[
                    ["Reason", draft.reason.trim()],
                    ["When away", draft.care_plan.trim() || "—"],
                    ["Promises", "Home visit and return policy accepted"],
                  ]}
                />
              </View>
            )}

            <View style={styles.applying}>
              <View style={styles.applyingLeft}>
                <View style={styles.applyingThumb}>
                  {animal.image ? (
                    <Image source={{ uri: animal.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <MaterialIcons name="pets" size={24} color="#B45309" />
                  )}
                </View>
                <View style={styles.applyingText}>
                  <View style={styles.applyingTop}>
                    <Text style={styles.applyingName} numberOfLines={1}>
                      Applying for: {animal.name}
                    </Text>
                    <Text style={styles.applyingBadge}>Rescued</Text>
                  </View>
                  {!!summary && <Text style={styles.applyingMeta}>{summary}</Text>}
                </View>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Choose another animal" onPress={openPicker} hitSlop={8}>
                <Text style={styles.change}>Change</Text>
              </Pressable>
            </View>

            {formError && (
              <View style={styles.formError} accessibilityLiveRegion="polite" accessibilityRole="alert">
                <MaterialIcons name="error-outline" size={16} color={colors.critical} />
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              onPress={next}
              disabled={submitting || !!unavailable}
              style={({ pressed }) => [styles.next, pressed && styles.nextPressed, (submitting || unavailable) && styles.nextDisabled]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <Text style={styles.nextText}>{step === 3 ? "Submit Application" : "Next"}</Text>
                  <Feather name={step === 3 ? "send" : "chevron-right"} size={step === 3 ? 15 : 17} color={colors.onPrimary} />
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.pickerBackdrop} onPress={() => setPicker(null)}>
          <Pressable accessible={false} style={styles.pickerCard} onPress={() => null}>
            <Text style={styles.pickerTitle}>Animals up for adoption</Text>
            {picker && picker.length === 0 ? (
              <ActivityIndicator color={colors.primary} style={styles.pickerLoading} />
            ) : (
              <ScrollView style={styles.pickerList}>
                {picker?.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() => chooseAnimal(item)}
                    style={({ pressed }) => [styles.pickerRow, pressed && styles.pickerRowPressed]}
                  >
                    <View style={styles.pickerThumb}>
                      {item.image && <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" />}
                    </View>
                    <View style={styles.pickerText}>
                      <Text style={styles.pickerName}>{item.name}</Text>
                      <Text style={styles.pickerMeta}>
                        {[capitalize(item.species), item.organization.name].filter(Boolean).join(" • ")}
                      </Text>
                    </View>
                    {item.id === animal?.id && <MaterialIcons name="check" size={20} color={colors.primary} />}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const BRAND_LIGHT = "rgba(234,243,240,0.6)";

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FAFBFB" },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadError: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkMuted, textAlign: "center" },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  back: { width: 40, height: 40, marginLeft: -4, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  backPressed: { backgroundColor: "rgba(226,232,240,0.5)" },
  title: { fontFamily: fonts.displayBold, fontSize: 16, letterSpacing: -0.4, color: "#0F172A" },
  navSpacer: { width: 40, height: 40 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10 },
  stepItem: { flexDirection: "row", alignItems: "center" },
  stepLine: { width: 32, height: 2, marginHorizontal: 10, backgroundColor: "#E2E8F0" },
  stepLineDone: { backgroundColor: "#CBD5E1" },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  stepActive: {
    borderWidth: 0,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  stepDone: { borderWidth: 0, backgroundColor: colors.primary },
  stepNumber: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: "#64748B" },
  stepNumberActive: { fontFamily: fonts.bodyBold, color: colors.onPrimary },
  heading: { marginTop: 16, marginBottom: 16 },
  stepTitle: { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 26, letterSpacing: -0.4, color: "#0F172A" },
  stepSubtitle: { marginTop: 2, fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: "#64748B" },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FEF7ED",
  },
  noticeText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12.5, lineHeight: 18, color: "#8A5A12" },
  form: { gap: 16 },
  field: { gap: 6 },
  choiceField: { gap: 8, paddingTop: 4 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: "#334155" },
  input: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: colors.surface,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: "#1E293B",
  },
  phone: { letterSpacing: 0.4 },
  inputInvalid: { borderColor: colors.critical },
  textArea: { height: 140, paddingTop: 14, lineHeight: 21 },
  textAreaSmall: { height: 88, paddingTop: 14, lineHeight: 21 },
  fieldError: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: "#B4483A" },
  counterRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  charCount: { marginLeft: "auto", fontFamily: fonts.body, fontSize: 11, color: "#64748B" },
  choiceRow: { flexDirection: "row", gap: 10 },
  choiceRowSolid: { gap: 12 },
  choice: {
    flex: 1,
    height: 44,
    paddingHorizontal: 6,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  choiceIdle: { borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: colors.surface },
  choiceOutlineOn: { borderWidth: 2, borderColor: colors.primary, backgroundColor: BRAND_LIGHT },
  choiceSolidOn: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  choiceText: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: "#475569" },
  choiceOutlineText: { fontFamily: fonts.bodySemiBold, color: colors.primary },
  choiceSolidText: { fontFamily: fonts.bodyBold, color: colors.onPrimary },
  choiceSolidIdleText: { fontFamily: fonts.bodySemiBold, color: "#475569" },
  counter: { flexDirection: "row", alignItems: "center", gap: 16 },
  counterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  counterDisabled: { opacity: 0.4 },
  counterValue: { minWidth: 28, textAlign: "center", fontFamily: fonts.displayBold, fontSize: 18, color: "#0F172A" },
  agreements: { gap: 10 },
  agreement: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: colors.surface,
  },
  agreementOn: { borderColor: colors.primary, backgroundColor: BRAND_LIGHT },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  agreementText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, color: "#334155" },
  review: {
    padding: 14,
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: colors.surface,
  },
  reviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  reviewTitle: { fontFamily: fonts.displayBold, fontSize: 14, color: "#0F172A" },
  reviewEdit: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.primary },
  reviewRow: { flexDirection: "row", gap: 12 },
  reviewLabel: { width: 110, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: "#64748B" },
  reviewValue: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 12.5, lineHeight: 18, color: "#1E293B" },
  applying: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.8)",
    backgroundColor: "#F8FAFC",
  },
  applyingLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  applyingThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.6)",
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  applyingText: { flex: 1 },
  applyingTop: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  applyingName: { flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, color: "#1E293B" },
  applyingBadge: {
    overflow: "hidden",
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    backgroundColor: "#ECFDF5",
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    lineHeight: 14,
    color: "#047857",
  },
  applyingMeta: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 15, color: "#64748B" },
  change: { paddingRight: 4, fontFamily: fonts.bodyBold, fontSize: 12, color: colors.primary },
  formError: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.criticalSoft,
  },
  formErrorText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: "#B4483A" },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: "#FAFBFB",
  },
  next: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 6,
  },
  nextPressed: { backgroundColor: "#165544", transform: [{ scale: 0.99 }] },
  nextDisabled: { backgroundColor: "#94A3B8", shadowOpacity: 0 },
  nextText: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.onPrimary },
  secondaryLink: { alignItems: "center", paddingVertical: 12 },
  secondaryLinkText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: "#64748B" },
  sent: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  sentBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  sentTitle: { fontFamily: fonts.displayExtraBold, fontSize: 24, color: "#0F172A" },
  sentBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: "#475569", textAlign: "center" },
  pickerBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.5)" },
  pickerCard: {
    maxHeight: "70%",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.surface,
  },
  pickerTitle: { marginBottom: 12, fontFamily: fonts.displayExtraBold, fontSize: 18, color: "#0F172A" },
  pickerLoading: { marginVertical: 24 },
  pickerList: { flexGrow: 0 },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  pickerRowPressed: { opacity: 0.7 },
  pickerThumb: { width: 48, height: 48, borderRadius: 12, overflow: "hidden", backgroundColor: "#F1F5F9" },
  pickerText: { flex: 1 },
  pickerName: { fontFamily: fonts.bodyBold, fontSize: 14, color: "#0F172A" },
  pickerMeta: { fontFamily: fonts.body, fontSize: 12, color: "#64748B" },
});
