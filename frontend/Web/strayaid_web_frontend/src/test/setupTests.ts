import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";

if (!global.TextEncoder) {
  // react-router uses TextEncoder in jsdom tests.
  global.TextEncoder = TextEncoder as typeof global.TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder as typeof global.TextDecoder;
}
