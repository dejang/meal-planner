import { useState, type CSSProperties } from "react";
import { imageUrl, type ResizedImage } from "../api";
import { Icon, IconName } from "./Icon";

export interface RecipePhotoProps {
  recipeId?: string | null;
  imageVersion?: string | null;
  image?: ResizedImage | null;
  alt: string;
  className?: string;
  style?: CSSProperties;
}

export function RecipePhoto({
  recipeId,
  imageVersion,
  image,
  alt,
  className = "",
  style,
}: RecipePhotoProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = image
    ? `data:image/jpeg;base64,${image.bytes}`
    : recipeId && imageVersion
      ? imageUrl(recipeId, imageVersion)
      : null;
  if (!url || url === failedUrl) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`recipe-photo recipe-photo-placeholder ${className}`}
        style={style}
      >
        <span className="recipe-photo-plate" aria-hidden="true">
          <span>
            <Icon name={IconName.ChefHat} />
          </span>
        </span>
        <span>A little kitchen inspiration</span>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className={`recipe-photo ${className}`}
      style={style}
      onError={() => setFailedUrl(url)}
    />
  );
}
