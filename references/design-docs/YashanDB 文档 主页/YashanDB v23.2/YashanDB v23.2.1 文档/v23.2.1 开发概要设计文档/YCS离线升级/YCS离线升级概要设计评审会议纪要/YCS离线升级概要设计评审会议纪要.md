Created by 陈步隆 on 一月 08, 2024

与会人：     [马志宏](https://conf.yasdb.com/display/~mazhihong)      [徐凡博](https://conf.yasdb.com/display/~xufanbo)      [许中立](https://conf.yasdb.com/display/~xuzhongli)      [瞿蓝孟](https://conf.yasdb.com/display/~qulanmeng)      [张茜](https://conf.yasdb.com/display/~zhangqian)      [张丽红](https://conf.yasdb.com/display/~zhanglihong)      [李垠](https://conf.yasdb.com/display/~liyin)      [陈步隆](https://conf.yasdb.com/display/~chenbulong)  

会议时间：2024-01-08 11:00 - 12:00

  


1. 升级只需处理OM内部环境变量，用户环境自己的环境变量需要用户自己维护

2. YCR备份只需一个节点操作，文档中明确一下 --- 陈步隆

3. 调整流程：离线升级完YCS后，拉起YCS，将DB拉到nomount状态 --- 陈步隆

4. DB升级，只需要一个DB进入升级模式，OM需要调整 --- 瞿蓝孟

5. YCS节点ID确认 --- 陈步隆

6. yac_rollback.sh调用需要说明清楚 --- 陈步隆

7. YCR导出工具需要回合到23.1，备份使用旧版本工具 --- 杜宇轩

8. 23.1版本时间点确认 --- 陈步隆

9. 跟OM的SR合并确认 --- 陈步隆

## Comments:

|  [](null)  ,1. 升级只需处理OM内部环境变量，用户环境自己的环境变量需要用户自己维护,2. YCR备份只需一个节点操作，文档中明确一下 --- 陈步隆 done,3. 调整流程：离线升级完YCS后，拉起YCS，将DB拉到nomount状态 --- 陈步隆 done,4. DB升级，只需要一个DB进入升级模式，OM需要调整 --- 瞿蓝孟,5. YCS节点ID确认 --- 陈步隆 done, yac_xx.sh脚本传入的节点ID为序号，从1开始,6. yac_rollback.sh调用需要说明清楚 --- 陈步隆 done,7. YCR导出工具需要回合到23.1，备份使用旧版本工具 --- 杜宇轩,8. 23.1版本时间点确认 --- 陈步隆 done，23.1.3已发布，23.1.4最近几天发布，不过从凡彬那边了解到，只需要做23.2大版本内小版本升级，不考虑23.1升级到23.2的场景,9. 跟OM的SR合并确认 --- 陈步隆 done，SR不合并，统一在OM的SR里测试,Posted by chenbulong at 一月 09, 2024 10:50|
|---|
