import Document, { Head, Html, Main, NextScript } from "next/document";

// Minimal Document to satisfy Next.js builds that expect a `/_document` module.
// This project primarily uses the App Router, but `_document` is still loaded during build.
export default class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head />
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

