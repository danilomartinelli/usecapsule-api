import NxWelcome from './nx-welcome';
import { AcmeReactUi } from '@acme/react-ui';

export function App() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-600 mb-4">Teste da Lib UI</h1>
      <AcmeReactUi />
      <div className="mt-8">
        <NxWelcome title="@acme/landing-page" />
      </div>
    </div>
  );
}

export default App;
