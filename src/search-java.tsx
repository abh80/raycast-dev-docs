import { DocSearchList } from "./components/DocSearchList";
import { javaProvider } from "./providers/java/provider";

export default function Command() {
  return <DocSearchList provider={javaProvider} />;
}
