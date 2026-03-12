export declare const apiName = "internal.contact.removePickedResult";
/**
 * 删除选人组件已选缓存 请求参数定义
 * @apiName internal.contact.removePickedResult
 */
export interface IInternalContactRemovePickedResultParams {
    /** 从选人组件已选缓存中获取结果的key (此token由选人组件产生，通过url参数等方式提前传递到小程序) */
    token: string;
}
/**
 * 删除选人组件已选缓存 返回结果定义
 * @apiName internal.contact.removePickedResult
 */
export interface IInternalContactRemovePickedResultResult {
}
/**
 * 删除选人组件已选缓存
 * @apiName internal.contact.removePickedResult
 * @supportVersion ios: 5.0.2 android: 5.0.2
 * @author android：宇睿，ios：鱼非
 */
export declare function removePickedResult$(params: IInternalContactRemovePickedResultParams): Promise<IInternalContactRemovePickedResultResult>;
export default removePickedResult$;
