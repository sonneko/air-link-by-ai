import ChatClient from '@/components/chat-client';

export default function Home() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center p-4 md:p-8 bg-background">
      <div className="w-full max-w-2xl">
        <ChatClient />
      </div>
    </main>
  );
}
