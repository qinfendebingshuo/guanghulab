export declare const apiName = "internal.teleVideo.addMember";
/**
 * 打开全局选人组件 请求参数定义
 * @apiName internal.teleVideo.addMember
 */
export interface IInternalTeleVideoAddMemberParams {
    /** 标题 */
    title: string;
    /** 是否多选 */
    multiple: boolean;
    /** 超过限定人数返回提示 */
    limitTips: string;
    /** 最大可选人数 */
    maxUsers: number;
    /** 已选用户 */
    pickedUsers: string[];
    /** 不可选用户 */
    disabledUsers: string[];
    /** 必选用户 (不可取消选中状态) */
    requiredUsers: string[];
    /** 是否显示手机通讯录 */
    isShowLocal: boolean;
    /** (>= 4.7.6) 是否显示群组 */
    isShowGroup: boolean;
    /** (>= 4.7.6) 是否直接打开群组 */
    isDirect2Group: boolean;
    /** (>= 4.7.19) 是否选设备 */
    isShowRoom: boolean;
}
/**
 * 打开全局选人组件 返回结果定义
 * @apiName internal.teleVideo.addMember
 */
export interface IInternalTeleVideoAddMemberResult {
    /** 选择人数 */
    selectedCount: number;
    /** 返回选人的列表，列表中的对象包含name (用户名)、avatar (用户头像)、uid (员工userid),offline(是否离线,仅视频设备返回)四个字段 */
    users: Array<{
        name: string;
        avatar: string;
        uid: string;
        offline: boolean;
    }>;
}
/**
 * 打开全局选人组件
 * @apiName internal.teleVideo.addMember
 * @supportVersion ios: 4.6.34 android: 4.6.34
 * @author android:柳樵; ios:钧鸿
 */
export declare function addMember$(params: IInternalTeleVideoAddMemberParams): Promise<IInternalTeleVideoAddMemberResult>;
export default addMember$;
