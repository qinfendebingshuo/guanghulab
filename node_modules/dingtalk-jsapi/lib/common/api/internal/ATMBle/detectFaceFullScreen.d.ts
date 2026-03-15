export declare const apiName = "internal.ATMBle.detectFaceFullScreen";
/**
 * 唤起蓝牙打卡实人实地全屏界面进行人脸识别 请求参数定义
 * @apiName internal.ATMBle.detectFaceFullScreen
 */
export interface IInternalATMBleDetectFaceFullScreenParams {
    /** 企业ID（Mock模式下可不填） */
    corpId?: string;
    /** 考勤组ID（Mock模式下可不填）） */
    groupId?: string;
    /** 设备ID（Mock模式下可不填） */
    deviceUid?: number;
    /** 考勤组内用户ID（Mock模式下可不填） */
    userId?: string;
    /** 用户名，对应识别后水印的名字（Mock模式下可不填） */
    userName?: string;
    /** 时间戳，对应识别后水印的时间（Mock模式下可不填） */
    timestamp?: number;
    /** 当前是否存在已录入的人脸，对应录入/识别模式 */
    hasFace: boolean;
    /** 是否需要美颜 */
    needBeauty?: boolean;
    /** 设备名，对应识别后水印的设备名（Mock模式下可不填） */
    deviceName?: string;
    /** 是否直接做动作活体（Mock模式下及正常模式下均可不填） */
    needFacePose?: boolean;
    /** 打卡方式，"auto"或者"manual"，此场景下埋点用 */
    checkWay?: string;
    /** 弹窗类型，埋点用，如需额外字段，需提前与客户端开发人员确认, 区分 正常（"0"） 二次确认（"1"） 人脸识别（"2"） 二次确认后人脸识别（"3"） */
    windowType?: string;
    /** 是否是Mock模式，此模式下识别/录入不真正进入流程，检测到人脸后即回调，此模式下只需要补充hasFace即可 */
    isMock?: boolean;
}
/**
 * 唤起蓝牙打卡实人实地全屏界面进行人脸识别 返回结果定义
 * @apiName internal.ATMBle.detectFaceFullScreen
 */
export interface IInternalATMBleDetectFaceFullScreenResult {
    /**
     * 人脸识别结果
     * 1:人脸验证/录入成功
     * 2:人脸验证/录入失败
     * 3:动作活体识别成功
     * 4:动作活体识别失败
     * 5:人脸弹窗显示失败，Activity为空/横屏/未登录/Activity指定不能弹出弹窗
     * 6:人脸弹窗显示失败，存在更高优先级的弹窗（打卡结果
     */
    photoStatus: number;
    /** 人脸识别成功后带的上传图片的url地址, 人脸录入成功后带的上传图片的带鉴权的url地址 */
    url: string;
}
/**
 * 唤起蓝牙打卡实人实地全屏界面进行人脸识别
 * @apiName internal.ATMBle.detectFaceFullScreen
 * @supportVersion android: 4.7.24
 * @author Android：序望
 */
export declare function detectFaceFullScreen$(params: IInternalATMBleDetectFaceFullScreenParams): Promise<IInternalATMBleDetectFaceFullScreenResult>;
export default detectFaceFullScreen$;
