export declare const apiName = "internal.ATMBle.beaconPickResult";
/**
 * B1设备选择器选择结果，只对一方，通过该接口与对外开放接口进行通信 请求参数定义
 * @apiName internal.ATMBle.beaconPickResult
 */
export interface IInternalATMBleBeaconPickResultParams {
    /** 调用biz.ATMBle.beaconPicker时生成的callbackId，用于传递结果 */
    callbackId: string;
    /** 选择结果，json对象，数据结构如下 */
    pickResult: {
        /** 选择的设备ID列表 */
        chosenBeacons: number[];
        /** 人脸识别开关 */
        useFaceRecognition: boolean;
        /** 设置的蓝牙设备距离 */
        distance: number;
    };
}
/**
 * B1设备选择器选择结果，只对一方，通过该接口与对外开放接口进行通信 返回结果定义
 * @apiName internal.ATMBle.beaconPickResult
 */
export interface IInternalATMBleBeaconPickResultResult {
}
/**
 * B1设备选择器选择结果，只对一方，通过该接口与对外开放接口进行通信
 * @apiName internal.ATMBle.beaconPickResult
 * @supportVersion ios: 5.0.7 android: 5.0.7
 * @author Android:序望，iOS：度尽
 */
export declare function beaconPickResult$(params: IInternalATMBleBeaconPickResultParams): Promise<IInternalATMBleBeaconPickResultResult>;
export default beaconPickResult$;
