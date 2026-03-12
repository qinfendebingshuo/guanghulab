export declare const apiName = "internal.log.searchClickLog";
/**
 * 搜索Clicklog通过魔兔上传 请求参数定义
 * @apiName internal.log.searchClickLog
 */
export interface IInternalLogSearchClickLogParams {
    /** 埋点版本号(version) */
    vs: number;
    /** UUID，64位log唯一标识 */
    uuid: string;
    /** Tab编号 */
    tab?: number;
    /** 点击区域编号(position_code) */
    p_c: number;
    /** 点击数据类型(type)  */
    t?: number;
    /** 点击数据值(value)，记录被点击项的唯一ID，如果是通讯录就是uid，聊天记录就是msgid */
    v?: string;
    /** 点击区域的位置值（position_value），例如2，如果点击类型是联系人，则表示点击了联系人 */
    p_v?: number;
}
/**
 * 搜索Clicklog通过魔兔上传 返回结果定义
 * @apiName internal.log.searchClickLog
 */
export interface IInternalLogSearchClickLogResult {
}
/**
 * 搜索Clicklog通过魔兔上传
 * @apiName internal.log.searchClickLog
 * @supportVersion  ios: 3.5.6 android: 3.5.6
 */
export declare function searchClickLog$(params: IInternalLogSearchClickLogParams): Promise<IInternalLogSearchClickLogResult>;
export default searchClickLog$;
