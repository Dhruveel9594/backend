import { v2 as cloudinary} from "cloudinary"

const deleteImage = async (imageUrl) => {

    try {
        
        if(!imageUrl) return null

        const parts = imageUrl.split("/");
        const filename = parts[parts.length - 1]; // image-name.jpg
        const publicIdWithExtension = parts.slice(parts.indexOf("upload") + 1).join("/"); // everything after 'upload/'
        const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, ""); // remove .jpg, .png, etc.

        // Delete from Cloudinary
        const response = await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
        });

        return response;

    } catch (error) {
        return null
    }

}

export {deleteImage};