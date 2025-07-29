import { UserLocation } from "@rnmapbox/maps";
import * as Location from "expo-location";
import { EventSubscription } from "expo-modules-core";

export class CustomUserLocation extends UserLocation {
  private customCoords: [number, number] = [0, 0];
  private headingSub: EventSubscription | null = null;

  async componentDidMount() {
    await super.componentDidMount?.();
    this.setLocationManager({ running: true });

    // Subscribe to heading updates from expo-location
    this.headingSub = await Location.watchHeadingAsync((heading) => {
      const headingValue = heading.trueHeading ?? heading.magHeading;
      this.setState({
        coordinates: this.customCoords,
        heading: headingValue,
      });
    });
  }

  async componentWillUnmount() {
    await super.componentWillUnmount?.();
    this.headingSub?.remove();
  }

  // Override location updates to force custom coords
  _onLocationUpdate(location: any) {
    const { coordinates, heading } = this.state;
    if (
      coordinates[0] !== this.customCoords[0] ||
      coordinates[1] !== this.customCoords[1]
    ) {
      this.setState({
        coordinates: this.customCoords,
        heading,
      });
    }
  }

  // Public API to change mock position
  public setCustomLocation(lng: number, lat: number) {
    this.customCoords = [lng, lat];
    this.setState({
      coordinates: this.customCoords,
      heading: this.state.heading,
    });
  }
}
