/**
 * 监听特征值变化事件 请求参数定义
 */
export declare type IUnionOffBLECharacteristicValueChangeParams = (e: IUnionOffBLECharacteristicValueChangeResult) => void;
/**
 * 监听特征值变化事件 返回结果定义
 */
export interface IUnionOffBLECharacteristicValueChangeResult {
    value: string;
    deviceId: string;
    serviceId: string;
    characteristicId: string;
}
/**
 * 移除监听特征值变化事件
 * @apiName offBLECharacteristicValueChange
 */
export declare function offBLECharacteristicValueChange$(params: IUnionOffBLECharacteristicValueChangeParams): void;
export default offBLECharacteristicValueChange$;
