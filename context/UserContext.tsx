import React, { createContext, ReactNode, useContext, useState } from "react";

type UserType = {
  name: string;
  class: string;
  color: string;
  // add other fields as needed
};

type UserContextType = {
  user: UserType | null;
  setUser: (user: UserType | null) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserType | null>(null);
  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within a UserProvider");
  return context;
};
