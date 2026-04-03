import UploadForm from './components/UploadForm';
import './App.css'
function App() {
  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Smart Health Record Analysis Using AI</h1>
        </div>
      </header>
      <main>
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <UploadForm />
        </div>
      </main>
    </div>
  );
}

export default App;
