export declare const apiName = "internal.facialRecognition.init";
/**
 * 初始化FacialRecognition 请求参数定义
 * @apiName internal.facialRecognition.init
 */
export interface IInternalFacialRecognitionInitParams {
    [key: string]: any;
}
/**
 * 初始化FacialRecognition 返回结果定义
 * @apiName internal.facialRecognition.init
 */
export interface IInternalFacialRecognitionInitResult {
    [key: string]: any;
}
/**
 * 初始化FacialRecognition
 * @apiName internal.facialRecognition.init
 * @supportVersion ios: 4.5.8 android: 4.5.8
 */
export declare function init$(params: IInternalFacialRecognitionInitParams): Promise<IInternalFacialRecognitionInitResult>;
export default init$;
