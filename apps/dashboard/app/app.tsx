import { AcmeReactUi } from '@acme/react-ui';
import NxWelcome from './nx-welcome';

export function App() {
  return (
    <div className="p-6 bg-gray-50">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Dashboard Test</h1>
      <div className="bg-white p-4 rounded-lg shadow">
        <AcmeReactUi />
      </div>
      <div className="mt-6">
        <NxWelcome title="@acme/dashboard" />
      </div>
    </div>
  );
}

export default App;
