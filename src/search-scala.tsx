import { DocSearchList } from "./components/DocSearchList";
import { scalaProvider } from "./providers/scala/provider";

export default function Command() {
  return <DocSearchList provider={scalaProvider} />;
}
