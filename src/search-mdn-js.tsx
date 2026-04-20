import { DocSearchList } from "./components/DocSearchList";
import { mdnProvider } from "./providers/mdn/provider";

export default function Command() {
  return <DocSearchList provider={mdnProvider} />;
}
