import NxWelcome from './nx-welcome';
import { AcmeReactUi } from '@acme/react-ui';

export function App() {
  return (
    <div className="p-6 bg-slate-50">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Portal Test</h1>
      <div className="bg-white p-4 rounded-lg shadow-md border">
        <AcmeReactUi />
      </div>
      <div className="mt-6">
        <NxWelcome title="@acme/portal" />
      </div>
    </div>
  );
}

export default App;
