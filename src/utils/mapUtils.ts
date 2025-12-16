
export const getMapUrl = (mapUid: string): string => {
    return `https://trackmania.exchange/s/tr/${mapUid}`;
};

// Using the UUID (mapId) is essentially how we get the storage object directly often.
// If mapUid is passed, it might not work with this specific URL.
// We'll trust the user's data provides the UUID in the 'mapId' field of totds.ts
export const getMapThumbnailUrl = (mapId: string): string => {
    return `https://core.trackmania.nadeo.live/storageObjects/${mapId}.jpg`;
};

export const getMapDownloadUrl = (mapUid: string): string => {
    return `https://trackmania.exchange/maps/download/${mapUid}`;
}
