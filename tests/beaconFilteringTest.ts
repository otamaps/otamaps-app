/**
 * Test script to verify OtaMaps beacon filtering logic
 * This simulates the filtering that happens in the BLE scanner
 */

// Mock device data representing different types of BLE devices
const mockDevices = [
  // Valid OtaMaps beacon
  {
    id: "AA:BB:CC:DD:EE:FF",
    name: "Room",
    localName: "Room",
    rssi: -45,
    serviceUUIDs: ["f47fcfd9-0634-49de-8e99-80d05ae8fcef"],
    serviceData: {
      "f47fcfd9-0634-49de-8e99-80d05ae8fcef": Buffer.from("001").toString('base64')
    },
    manufacturerData: Buffer.from("001").toString('base64')
  },
  
  // Another valid OtaMaps beacon with different room ID
  {
    id: "11:22:33:44:55:66",
    name: "Room", 
    localName: "Room",
    rssi: -60,
    serviceUUIDs: ["f47fcfd9-0634-49de-8e99-80d05ae8fcef"],
    serviceData: {
      "f47fcfd9-0634-49de-8e99-80d05ae8fcef": Buffer.from("A123").toString('base64')
    },
    manufacturerData: Buffer.from("A123").toString('base64')
  },
  
  // OtaMaps beacon with weak signal (should be filtered out)
  {
    id: "77:88:99:AA:BB:CC",
    name: "Room",
    localName: "Room", 
    rssi: -90, // Too weak
    serviceUUIDs: ["f47fcfd9-0634-49de-8e99-80d05ae8fcef"],
    serviceData: {
      "f47fcfd9-0634-49de-8e99-80d05ae8fcef": Buffer.from("002").toString('base64')
    }
  },
  
  // Non-OtaMaps beacon (should be filtered out)
  {
    id: "DD:EE:FF:00:11:22",
    name: "SomeOtherDevice",
    rssi: -50,
    serviceUUIDs: ["12345678-1234-1234-1234-123456789012"], // Different UUID
    serviceData: {
      "12345678-1234-1234-1234-123456789012": Buffer.from("randomdata").toString('base64')
    }
  },
  
  // Device with correct UUID but wrong name (should be filtered out)
  {
    id: "33:44:55:66:77:88",
    name: "WrongName",
    rssi: -40,
    serviceUUIDs: ["f47fcfd9-0634-49de-8e99-80d05ae8fcef"],
    serviceData: {
      "f47fcfd9-0634-49de-8e99-80d05ae8fcef": Buffer.from("003").toString('base64')
    }
  },
  
  // OtaMaps beacon with "none" room ID (unconfigured ESP32, should be filtered out)
  {
    id: "99:AA:BB:CC:DD:EE",
    name: "Room",
    rssi: -55,
    serviceUUIDs: ["f47fcfd9-0634-49de-8e99-80d05ae8fcef"],
    serviceData: {
      "f47fcfd9-0634-49de-8e99-80d05ae8fcef": Buffer.from("none").toString('base64')
    }
  }
];

// Test beacon filtering logic
function testBeaconFiltering() {
  console.log("🧪 Testing OtaMaps Beacon Filtering Logic\\n");
  
  const RSSI_THRESHOLD = -80;
  const OTAMAPS_SERVICE_UUID = "f47fcfd9-0634-49de-8e99-80d05ae8fcef";
  
  const validBeacons: any[] = [];
  
  mockDevices.forEach((device, index) => {
    console.log(`\\n📡 Testing Device ${index + 1}: ${device.id}`);
    console.log(`   Name: ${device.name}, RSSI: ${device.rssi} dBm`);
    
    // Check if device name matches OtaMaps beacon pattern
    const isCorrectName = device.name === "Room" || device.localName === "Room";
    console.log(`   ✓ Correct name: ${isCorrectName}`);
    
    // Check if device advertises the OtaMaps service UUID
    const hasOtaMapsService = device.serviceUUIDs?.some(
      uuid => uuid.toLowerCase() === OTAMAPS_SERVICE_UUID.toLowerCase()
    ) || false;
    console.log(`   ✓ Has OtaMaps service: ${hasOtaMapsService}`);
    
    // Check if device has service data for OtaMaps UUID
    const hasOtaMapsServiceData = device.serviceData && 
      Object.keys(device.serviceData).some(
        uuid => uuid.toLowerCase() === OTAMAPS_SERVICE_UUID.toLowerCase()
      );
    console.log(`   ✓ Has service data: ${!!hasOtaMapsServiceData}`);
    
    // Check RSSI threshold
    const hasValidSignal = device.rssi !== null && device.rssi >= RSSI_THRESHOLD;
    console.log(`   ✓ Valid signal strength: ${hasValidSignal}`);
    
    // Extract room ID
    let roomId = null;
    if (hasOtaMapsServiceData) {
      try {
        const serviceData = (device.serviceData as any)[OTAMAPS_SERVICE_UUID] || 
                           (device.serviceData as any)[OTAMAPS_SERVICE_UUID.toLowerCase()];
        if (serviceData) {
          roomId = Buffer.from(serviceData, 'base64').toString('utf8');
        }
      } catch (error) {
        console.log(`   ⚠️  Error extracting room ID: ${error}`);
      }
    }
    
    const isValidRoomId = roomId && roomId !== "none" && roomId.length > 0;
    console.log(`   ✓ Valid room ID: ${isValidRoomId} (${roomId || 'none'})`);
    
    // Final decision
    const isValidBeacon = (hasOtaMapsService || !!hasOtaMapsServiceData) && 
                         hasValidSignal && 
                         isCorrectName && 
                         isValidRoomId;
    
    console.log(`   🎯 RESULT: ${isValidBeacon ? '✅ ACCEPTED' : '❌ REJECTED'}`);
    
    if (isValidBeacon) {
      validBeacons.push({
        id: device.id,
        roomId: roomId,
        rssi: device.rssi
      });
    }
  });
  
  console.log(`\\n\\n📊 SUMMARY:`);
  console.log(`   Total devices tested: ${mockDevices.length}`);
  console.log(`   Valid OtaMaps beacons: ${validBeacons.length}`);
  console.log(`\\n✅ Valid Beacons:`);
  validBeacons.forEach(beacon => {
    console.log(`   - Room ID: ${beacon.roomId}, RSSI: ${beacon.rssi} dBm`);
  });
}

// Run the test
if (require.main === module) {
  testBeaconFiltering();
}

export { testBeaconFiltering };
