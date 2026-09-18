/**
 * Whether this account went through onboarding **during this launch of the app**.
 *
 * It exists because nothing stored can answer that question. A brand-new account and an existing
 * reader who never finished the tour look identical on Ana sayfa — `hasSeenOnboarding: true`,
 * `hasSeenTour: false` — since the new account set the first of those seconds earlier. The
 * difference is not in the data, it is in how the app got here: a newcomer passed through
 * `OnboardingScreen`, and an existing reader launched straight into the tabs.
 *
 * **Deliberately in memory, and deliberately not persisted.** It is a fact about this process,
 * not about the account: once the app is restarted that person is an existing reader like anybody
 * else, which is exactly the semantics `useWhatsNew` wants.
 */
let didOnboard = false;

/** Called by `OnboardingScreen` as it writes `hasSeenOnboarding`. */
export const markOnboardedThisLaunch = () => {
	didOnboard = true;
};

export const didOnboardThisLaunch = () => didOnboard;
