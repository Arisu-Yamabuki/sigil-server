PRIVACY POLICY

Effective Date: November 4, 2026

Sigil ("we," "our," or "us") operates the Sigil Android application and the relay server located at https://sigil.adnand.com. Sigil is an open-source, end-to-end encrypted messaging platform designed with a zero-trust architecture. 

Because your privacy is the fundamental foundation of our platform, our systems are explicitly built so that we cannot read your messages or access your private cryptographic keys.

========================================================================
1. INFORMATION WE COLLECT AND PROCESS
========================================================================
We minimize data collection to the absolute technical minimum required to relay encrypted text packets between users. 

* Account Data: When you create an account, we collect the username you choose and a cryptographic hash of your password. We never see or store your actual plaintext password.
* Public Keys: To enable others to send you encrypted messages, your public GPG key is uploaded and stored on the server. Anyone searching your username can retrieve this public key.
* Encrypted Message Logs (Ciphertext): The server temporarily receives, stores, and relays fully scrambled text (ciphertext). We cannot view the content of these messages.
* Metadata & Timers: We process timestamps and your customized chat timer settings to automate message deletion from the database.

========================================================================
2. INFORMATION WE NEVER COLLECT OR STORE
========================================================================
Our systems are physically incapable of accessing, recording, or tracking the following data points:

* Message Contents & Private Keys: Your private GPG key and its passphrase are never uploaded to the server. Plaintext message decryption occurs strictly locally on your device. 
* Media & Identity Triggers: We do not support, collect, or store profile pictures, user avatars, or device identifiers.
* Cloud Backups: The app explicitly disables automated Android cloud backups, keeping your keys and message archives localized to your physical device.

========================================================================
3. DATA RETENTION AND DELETION
========================================================================
* Server Logs: The server deletes expired messages automatically based on the conversational or per-message timers configured by the chat participants.
* On-Device Memory: Decrypted message text and your key passphrases live strictly inside your device’s volatile, temporary RAM. They are fully wiped from memory as soon as you exit the chat screen, sign out, or lock the app.
* Manual Deletion: You can trigger explicit deletion requests for messages you have sent, removing them directly from the database.

========================================================================
4. DATA SHARING AND THIRD PARTIES
========================================================================
We do not sell, rent, monetize, or share any user data with third-party corporations, advertisers, or analytics providers. Because we do not log real identities, device indicators, or raw message texts, we have no readable communication data to share, even when requested.

========================================================================
5. SECURITY PRACTICES
========================================================================
* Screenshot Protections: The application relies on Android's FLAG_SECURE layout environment, rendering it impossible to capture system screenshots or display content previews within the OS recent apps screen.
* Encryption Standard: All user communications rely entirely on public/private GPG keypairs initialized or imported directly by the device holder.

========================================================================
6. CHANGES TO THIS POLICY
========================================================================
We may update our Privacy Policy occasionally to align with changes in open-source app updates. We encourage you to review the codebase documentation or server status links regularly to stay informed of our data security paradigms. 

------------------------------------------------------------------------
For questions regarding our privacy standard or to inspect our transparent open-source code architecture, please visit our public repository at https://github.com/Arisu-Yamabuki/Sigil
