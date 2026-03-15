export declare const apiName = "biz.faceBox.startCameraRecordFromPartner";
/**
 * 唤起人脸录入界面 请求参数定义
 * @apiName biz.faceBox.startCameraRecordFromPartner
 */
export interface IBizFaceBoxStartCameraRecordFromPartnerParams {
    [key: string]: any;
}
/**
 * 唤起人脸录入界面 返回结果定义
 * @apiName biz.faceBox.startCameraRecordFromPartner
 */
export interface IBizFaceBoxStartCameraRecordFromPartnerResult {
    [key: string]: any;
}
/**
 * 唤起人脸录入界面
 * @apiName biz.faceBox.startCameraRecordFromPartner
 * @supportVersion ios: 4.3.0 android: 4.3.0
 */
export declare function startCameraRecordFromPartner$(params: IBizFaceBoxStartCameraRecordFromPartnerParams): Promise<IBizFaceBoxStartCameraRecordFromPartnerResult>;
export default startCameraRecordFromPartner$;
