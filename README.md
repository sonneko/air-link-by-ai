# AirLink

AirLink is a serverless, ad-hoc, and private chat application that allows two users to communicate directly using WebRTC. There's no server, no sign-up, and no message history stored anywhere. Just a simple, direct, and ephemeral connection.

## Features

- **Serverless & Private**: All communication happens directly between peers. No data passes through or is stored on a central server.
- **Simple Connection**: Easily start a chat by sharing a QR code or a small text snippet.
- **Progressive Web App (PWA)**: Install AirLink on your mobile device or desktop for a native-like experience, including offline access and its own window.
- **Clean UI**: A modern and intuitive interface built with shadcn/ui and Tailwind CSS.

## How to Use

1.  **Open the App**: Navigate to the AirLink URL.
2.  **Create a Chat Session**:
    - Click `Create New Chat`.
    - Share the generated QR code or the text block with a friend.
    - Wait for your friend to send their information back, then paste or scan it into the input field and click `Connect`.
3.  **Join a Chat Session**:
    - Ask your friend to create a session and send you their QR code or text.
    - Click `Join Chat` and paste the text, or click the `Scan` button to use your camera.
    - After generating your info, share it back with your friend for them to complete the connection.
4.  **Start Chatting**: Once the connection is established, you can start sending messages directly to your friend!

## For Developers

This project is a Next.js application built with the App Router, TypeScript, and WebRTC for real-time communication.

### Tech Stack

- **Framework**: [Next.js](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **UI Framework**: [React](https://reactjs.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Real-time Communication**: [WebRTC](https://webrtc.org/)

### Getting Started

To get a local copy up and running, follow these simple steps.

#### Prerequisites

- Node.js (v20 or later)
- npm

#### Installation & Running

1.  **Clone the repo:**
    ```sh
    git clone <your-repo-url>
    cd <your-repo-name>
    ```

2.  **Install NPM packages:**
    ```sh
    npm install
    ```

3.  **Run the development server:**
    ```sh
    npm run dev
    ```
    Open [http://localhost:9002](http://localhost:9002) to view it in the browser.

### Available Scripts

-   `npm run dev`: Starts the development server.
-   `npm run build`: Creates a production build of the application in the `./out` directory.
-   `npm run start`: Starts a production server (requires `npm run build` first).
-   `npm run lint`: Lints the codebase for errors.

### Continuous Deployment

This repository is configured with a GitHub Actions workflow (`.github/workflows/deploy.yaml`) to automatically build and deploy the application to GitHub Pages whenever code is pushed to the `main` branch.
