export declare const apiName = "internal.ATMBle.getPunchEventClockCheckResult";
/**
 * 获取当前多场景小闹钟的校验结果，频率由前端控制。 请求参数定义
 * @apiName internal.ATMBle.getPunchEventClockCheckResult
 */
export interface IInternalATMBleGetPunchEventClockCheckResultParams {
}
/**
 * 获取当前多场景小闹钟的校验结果，频率由前端控制。 返回结果定义
 * @apiName internal.ATMBle.getPunchEventClockCheckResult
 */
export declare type IInternalATMBleGetPunchEventClockCheckResultResult = Array<{
    /** 各场景下事件的唯一ID，与bizCode结合成为复合主键 */
    outerId: string;
    /** 事件类型对应业务场景 */
    bizCode: string;
    corpId: string;
    bizContext: string;
    bleCheckResult: {
        deviceUid: any;
        devId: any;
        devServiceId: any;
        major: any;
        minor: any;
        retainData: any;
    };
    wifiCheckResult: {
        macAddress: any;
        ssid: any;
    };
    poiCheckResult: {
        lat: any;
        lon: any;
        accuracy: any;
    };
}>;
/**
 * 获取当前多场景小闹钟的校验结果，频率由前端控制。
 * @apiName internal.ATMBle.getPunchEventClockCheckResult
 * @supportVersion ios: 5.0.7 android: 5.0.7
 * @author Android：序望，iOS：度尽
 */
export declare function getPunchEventClockCheckResult$(params: IInternalATMBleGetPunchEventClockCheckResultParams): Promise<IInternalATMBleGetPunchEventClockCheckResultResult>;
export default getPunchEventClockCheckResult$;
