export declare const apiName = "taurus.common.chooseImage";
export declare enum ImageType {
    image = 0,
    video = 1
}
/**
 * 选择本地图片 请求参数定义
 * @apiName taurus.common.chooseImage
 */
export interface ITaurusCommonChooseImageParams {
    enableVideo?: boolean;
}
export interface IImage {
    size: number;
    path: string;
    type: ImageType;
    lastModified?: number;
}
/**
 * 选择本地图片 返回结果定义
 * @apiName taurus.common.chooseImage
 */
export interface ITaurusCommonChooseImageResult {
    images: IImage[];
}
/**
 * 选择本地图片
 * @apiName taurus.common.chooseImage
 * @supportVersion ios: 1.3.2 android: 1.3.2
 */
export declare function chooseImage$(params: ITaurusCommonChooseImageParams): Promise<ITaurusCommonChooseImageResult>;
export default chooseImage$;
