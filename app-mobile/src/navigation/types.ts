import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type VehicleDraft = {
  kind: 'car' | 'moto';
  brand: string;
  model: string;
  year: number;
  plate: string;
  color: string;
  km: number;
};

export type TabParamList = {
  Home: undefined;
  Vehicles: undefined;
  Menu: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Signup: undefined;
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  VehicleDetail: { vehicleId: string };
  AddVehicleType: undefined;
  AddVehicleForm: { kind: 'car' | 'moto' };
  AddOil: { vehicleId?: string; draft?: VehicleDraft };
  History: undefined;
  Notifications: undefined;
  // Alerts y Profile eran tabs; con la barra en tres destinos viven en el
  // stack y se llega a ellos desde el Menú o desde el hero del inicio.
  Alerts: undefined;
  Profile: undefined;
  CustomizeHome: undefined;
};

export type RootScreenProps<S extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  S
>;
