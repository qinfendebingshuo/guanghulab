export declare const apiName = "biz.faceBox.experienceFunction";
/**
 * 体验功能 请求参数定义
 * @apiName biz.faceBox.experienceFunction
 */
export interface IBizFaceBoxExperienceFunctionParams {
    [key: string]: any;
}
/**
 * 体验功能 返回结果定义
 * @apiName biz.faceBox.experienceFunction
 */
export interface IBizFaceBoxExperienceFunctionResult {
    [key: string]: any;
}
/**
 * 体验功能
 * @apiName biz.faceBox.experienceFunction
 * @supportVersion  ios: 4.2.8 android: 4.2.8
 */
export declare function experienceFunction$(params: IBizFaceBoxExperienceFunctionParams): Promise<IBizFaceBoxExperienceFunctionResult>;
export default experienceFunction$;
