import { createContext, useContext } from 'react';

/**
 * True for anything rendered inside `AppBottomSheet`.
 *
 * It exists for one reason: `@gorhom/bottom-sheet` only learns that a field has focus
 * through its own `BottomSheetTextInput`, so a sheet holding a plain `TextInput` never
 * lifts and the keyboard covers it. `AppInput` reads this to pick the right component,
 * which keeps every form in the app writing `Field`/`AppInput` and not caring where it
 * happens to be mounted.
 *
 * A context rather than sniffing the library's internals: `useBottomSheetInternal` throws
 * outside a sheet, so it can't answer "am I in one" without a try/catch around a hook.
 */
const IsInsideSheetContext = createContext(false);

export const IsInsideSheetProvider = IsInsideSheetContext.Provider;

export const useIsInsideSheet = () => useContext(IsInsideSheetContext);
