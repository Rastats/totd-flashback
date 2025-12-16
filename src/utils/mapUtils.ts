
export const getMapUrl = (mapUid: string): string => {
    return `https://trackmania.exchange/s/tr/${mapUid}`;
};

export const getMapThumbnailUrl = (mapUid: string): string => {
    // Common pattern using trackmania.io for convenience, though dependent on their cache.
    // Alternatively, we could fetch from TMX API if this proves unreliable.
    return `https://trackmania.io/img/maps/${mapUid}.jpg`;
};

export const getMapDownloadUrl = (mapUid: string): string => {
    return `https://trackmania.exchange/maps/download/${mapUid}`;
}
