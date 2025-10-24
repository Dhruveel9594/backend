import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import { deleteImage } from "../utils/deleteImage.js"
import mongoose from "mongoose"

const generateAccessTokenAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId)

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken,refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh tokens")
    }
}

const registerUser = asyncHandler( async(req,res) => {
    //1:get user details from frontend
    //2:validation - not empty
    //3:check if user for already exists: username, email
    //4:check for images, check for avatar
    //5:upload them to cloudinary, avatar
    //6:create user object - create entry in db
    //7:remove password and refresh token from response
    //8:check for user creation 
    //9:return res

    //step1
    const {fullName, username , email , password } = req.body
    //step2
    if(
        [fullName,email,username,password].some( (field) => field?.trim() === "" ) 
    )
    {
        throw new ApiError(400,"All fileds are required")
    }

    //step3
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if(existedUser){
        throw new ApiError(409, "User with email or username alreaady exists")
    }
    // console.log(req.body);
    
    //step4
    const avatarLocalPath = req.files?.avatar[0].path;
    // const coverImageLocalPath = req.files?.coverImage[0].path;

    let coverImageLocalPath;
    if(req.files &&  Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0 ){
        coverImageLocalPath = req.files?.coverImage[0].path;
    }

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required" )
    }

    //step5
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar) {
        throw new ApiError(400, "Avatar file is required" )
    }

    //step6
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username
    })

    //step7:
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    //step8:
    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    //step9:
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

} )

const loginUser = asyncHandler( async(req,res) => {
    //req body -> data
    //username or email
    //find the user
    //password check
    //access token and refresh token
    //send cookie

    const {username, email , password} = req.body

    if(!username && !email) {
        throw new ApiError(400, "username or email is required")
        
    }

    const user = await User.findOne({
        $or: [{email},{username}]
    })

    if(!user) {
        throw new ApiError(404, "user does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials")
    }

    const {accessToken, refreshToken} = await generateAccessTokenAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )
})

const logOutUser = asyncHandler( async(req,res) => {
    //cookie clear 
    // remove tokens

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {}, "User logged out")
    )

})

const refreshAccessToken = asyncHandler( async(req,res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessTokenAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, "Invalid refresh token")
    }

})

const changeCurrentPassword = asyncHandler( async(req,res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid old Password")
    }

    user.password = newPassword

    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json( new ApiResponse(200,{}, "Password changed successfully") )

})

const getCurrentUser = asyncHandler(async(req,res) => {
    return res
    .status(200)
    .json( new ApiResponse(200, req.user, "current user fetched"))
})

const updateAccountDetails = asyncHandler(async(req,res) => {
    
    const {fullName , email} = req.body

    if(!fullName || !email){
        throw new ApiError(400,"All fiels are required")
    }

    const user =  await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email
            }
        },
        {new: true}
    ).select( "-password")

    return res
    .status(200)
    .json( new ApiResponse(200, user, "Account details updated successfully"))

})

const updateUserAvatar = asyncHandler( async(req,res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath) {
        throw new ApiError(400,"Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400,"Error while uploading on avatar")
    }

    const user = await User.findById(
        req.user?._id
    )

    if (user.avatar) {
        deleteImage(user.avatar)
    }

    user.avatar = avatar.url

    await user.save({ validateBeforeSave: false });

    const updatedUser = user.toObject();
    delete updatedUser.password;

    return res
    .status(200)
    .json( new ApiResponse(200, updatedUser, "Avatar updated successfully"))

})

const updateUserCoverImage = asyncHandler( async(req,res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath) {
        throw new ApiError(400,"CoverImage file is required")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading on coverImage")
    }

    const user = await User.findById(
        req.user?._id
    )

    if (user.coverImage) {
        deleteImage(user.coverImage)
    }

    user.coverImage = coverImage.url

    await user.save({ validateBeforeSave: false });

    const updatedUser = user.toObject();
    delete updatedUser.password;

    return res
    .status(200)
    .json( new ApiResponse(200, updatedUser, "coverImage updated successfully"))

})

const gerUserChannelProfile = asyncHandler(async(req,res) => {
    const {username} = req.params

    if(!username?.trim()){
        throw new ApiError(400, "username not found");
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localFeild: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFileds: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelSubsctibedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelSubsctibedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if(!channel?.length) {
        throw new ApiError(400, "channel does not exist");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )

})

const getWatchHistory = asyncHandler(async(req,res) => {
    const user = await User.aggregate([
        {
            $match: {
                //why not direct req.user?._id because when u use aggregate it must be converted into objectId beacuse in mongodb we need object id but req.user?._id give us string 
                _id: mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                //nested pipline   
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1, 
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFileds: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(200, user[0].watchHistory, "watch history fetched successfully")
    )
})

export {
    registerUser,
    loginUser,
    logOutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    gerUserChannelProfile,
    getWatchHistory
}