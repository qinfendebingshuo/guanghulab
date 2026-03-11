export declare const apiName = "internal.ATMBle.faceManagerResult";
/**
 * 人脸识别管理组件设置结果，只对一方，通过该接口与对外开放接口进行通信 请求参数定义
 * @apiName internal.ATMBle.faceManagerResult
 */
export interface IInternalATMBleFaceManagerResultParams {
    /** 调用biz.ATMBle.punchModePicker时生成的callbackId，用于传递结果 */
    callbackId: string;
    settingResult: {
        switchValue: boolean;
    };
}
/**
 * 人脸识别管理组件设置结果，只对一方，通过该接口与对外开放接口进行通信 返回结果定义
 * @apiName internal.ATMBle.faceManagerResult
 */
export interface IInternalATMBleFaceManagerResultResult {
}
/**
 * 人脸识别管理组件设置结果，只对一方，通过该接口与对外开放接口进行通信
 * @apiName internal.ATMBle.faceManagerResult
 * @supportVersion ios: 5.0.7 android: 5.0.7
 * @author Android：序望，iOS：度尽
 */
export declare function faceManagerResult$(params: IInternalATMBleFaceManagerResultParams): Promise<IInternalATMBleFaceManagerResultResult>;
export default faceManagerResult$;
