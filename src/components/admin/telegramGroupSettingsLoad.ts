export function createLatestGroupSettingsRequest() {
  let currentRequest = 0;

  return {
    begin() {
      currentRequest += 1;
      return currentRequest;
    },
    isCurrent(requestId: number) {
      return requestId === currentRequest;
    },
  };
}
