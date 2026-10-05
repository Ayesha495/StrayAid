import { Platform } from "react-native";

type LocalFile = { uri: string; name: string; type: string };

// Adds a picked photo to multipart form data. React Native uploads { uri, name, type }
// directly; a browser needs the actual file contents as a Blob.
export async function appendFile(form: FormData, field: string, file: LocalFile) {
  if (Platform.OS === "web") {
    const blob = await (await fetch(file.uri)).blob();
    form.append(field, blob, file.name);
  } else {
    form.append(field, file as never);
  }
}
