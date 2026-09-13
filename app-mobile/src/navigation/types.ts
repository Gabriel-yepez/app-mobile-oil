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
  Alerts: undefined;
  Me: undefined;
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
};

export type RootScreenProps<S extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  S
>;
