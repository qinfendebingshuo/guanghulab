export declare const apiName = "biz.tag.mark";
/**
 * 呼起打标页面 请求参数定义
 * @apiName biz.tag.mark
 */
export interface IBizTagMarkParams {
    /** 实体类型，例如 消息、联系人、会话 */
    entityType: string;
    /** 实体 id，例如 消息id、uid、cid  */
    entityId: string;
    /** 来源：im_chatlist、im_msglist 。规则： 业务缩写_场景 */
    source: string;
    /** 实体子类型。给消息打标传：im_text、im_img、im_audio、im_video  即消息类型枚举，业务自行决定枚举 */
    entitySubtype?: string;
    /** 打标窗口 title， 覆盖默认title，可选 */
    title?: string;
}
/**
 * 呼起打标页面 返回结果定义
 * @apiName biz.tag.mark
 */
export interface IBizTagMarkResult {
}
/**
 * 呼起打标页面
 * @apiName biz.tag.mark
 * @supportVersion ios: 5.1.40 android: 5.1.40 pc: 5.1.40
 * @author PC：心存, iOS：木锤, Android：峰砺
 */
export declare function mark$(params: IBizTagMarkParams): Promise<IBizTagMarkResult>;
export default mark$;
