Created by 马志宏, last modified on 二月 04, 2024

*IR链接：*    [YDBRD-25499](https://jira.yasdb.com/browse/YDBRD-25499?src=confmacro)    *-*  *yasrman在PITR时支持使用最近备份集或者归档*  *设计中*

*SR链接：*    [YDBRD-26669](https://jira.yasdb.com/browse/YDBRD-26669?src=confmacro)    *-*  *yasrman在PITR时自动搜索备份集*  *设计中*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

需求来源于鼎甲适配PITR功能，崖山目前的PITR，必须先选择一个较早的数据库备份集，恢复后，再恢复归档日志，再执行PITR的recovery。而鼎甲适配oracle的PITR，只需要输入一个until time，数据库备份集会自动去查找。因此需要支持PITR时，自动查找最近的备份集，自动恢复归档日志，提高易用性。由于该特性属于成熟模块的小特性，因此概要设计和详细设计合一，IR只包含一个SR。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

需求来源于鼎甲适配PITR功能。崖山目前的PITR，必须先选择一个较早的数据库备份集，恢复后，再恢复归档日志，再执行PITR的recovery。而鼎甲适配oracle的PITR，只需要输入一个until time，数据库备份集会自动去查找。鼎甲希望我们的接口也只需要输入一个until time，就能完成整个PITR流程。所涉及的部署形态是单机和集群。

通常，每隔几天做一次全量或增量备份，然后每隔几小时进行归档备份。当数据库发生损坏后，可以借助数据库备份集和归档备份集，恢复到指定的时间点。但是数据库上最新产生的部分可能还没来的及备份，因此数据库本地的归档文件，在PITR恢复时，也需要复用，尽可能减少数据丢失。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

**概述**   连接  *。*

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|执行PITR时，自动找最近的备份集|找备份集时，如果指定了DBID，则找DBID对应的整库备份集，这个备份集的scn小于目标scn，并且是最接近目标scn的|是|是|
|  
|从备份集恢复归档文件后，继续复用本地归档|恢复完整库备份，继续恢复归档备份，如果归档恢复后，还差一些归档日志，则尝试复用本地的归档，尽可能减少数据丢失|是|是|
|性能|  
|----|否|否|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|PITR|基于时间点的恢复|是|  
|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

不涉及。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

语法图：

![](https://pingcode.yasdb.com/atlas/files/public/67396cc4a1ad9a3311dc8ca7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBQkFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBZ0FBQUFBQUFnQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ1FBQUFBRkFDUUFDQUFBQUVBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFnPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMzMDcsImV4cCI6MTc4MjMxNDEwN30.FGTeIlGySNfxqrCMtuQmgK6oTIlH3ck_hvvUHBeod3w)

其中DBID是指定数据库的ID，数据库ID在建库后就不会变化，即使进行了备份恢复操作也不会变，这个是为了区分多个数据库的备份集。

如果不指定DBID，则只会选择scn最接近目标scn的备份集。指定DBID后，只会搜索相同DBID的备份集。

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

规格：

1. PITR执行时，会尽可能复用数据库本地的归档，以便尽可能恢复到目标点
1. until time的目标时间，如果最终恢复的时间误差小于1s，则不报错。即until time允许有1s的误差
1. database id为正数


约束：

1. 不支持分布式部署；
1. 自动查找的数据库备份集和归档备份集，必须是通过yasrman备份的。SQL命令执行的备份集无法自动扫描


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

**从IR层级架构方案设计的说明，要呼应1.4章节需求描述中，对特性交付的质量属性详细展开。**     针对功能、性能、可用性、可靠性、可维可测等各维度实现时，关键技术点（技术方案、技术难点、技术风险）的展开。

![](https://pingcode.yasdb.com/atlas/files/public/67396cc4a1ad9a3311dc8ca8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBQkFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBZ0FBQUFBQUFnQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ1FBQUFBRkFDUUFDQUFBQUVBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFnPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMzMDcsImV4cCI6MTc4MjMxNDEwN30.FGTeIlGySNfxqrCMtuQmgK6oTIlH3ck_hvvUHBeod3w)

常见的备份策略如上图，每隔几天做一次全库备份，然后定期做归档备份，归档备份完成后，清理数据库归档，释放磁盘空间。当数据库损坏，需要恢复到较早时间点时，先要找到最接近目标时间点的全库备份（可以是全量备份，也可以是增量备份）。然后恢复目标范围内的归档日志（全量备份集里也包含部分归档，这部分不会重复恢复）。此外，由于备份归档不是实时的，因此可能有需要的归档没有备份，这些归档不会自动清理，可以尝试复用，以保证既可能的恢复到目标时间点。

###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

### 目标归档已全部备份

  


![](https://pingcode.yasdb.com/atlas/files/public/67396cc4a1ad9a3311dc8ca9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBQkFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBZ0FBQUFBQUFnQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ1FBQUFBRkFDUUFDQUFBQUVBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFnPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMzMDcsImV4cCI6MTc4MjMxNDEwN30.FGTeIlGySNfxqrCMtuQmgK6oTIlH3ck_hvvUHBeod3w)

如果PITR的目标时间，对应的归档已经备份，那么在恢复时，不会复用本地归档文件，具体流程如下：

1. 将用户传入的时间，转换为目标scn（时间以数据库所在时区为准）
1. 在catalog里搜索对应DBID的数据库备份集，该备份集的scn小于目标scn，并且最接近目标scn。如果没有找到，则报错
1. 恢复该数据库备份集
1. 恢复目标scn之前的归档备份
1. 执行alter database open resetlogs


![](https://pingcode.yasdb.com/atlas/files/public/67396cc4a1ad9a3311dc8caa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBQkFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBZ0FBQUFBQUFnQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ1FBQUFBRkFDUUFDQUFBQUVBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFnPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMzMDcsImV4cCI6MTc4MjMxNDEwN30.FGTeIlGySNfxqrCMtuQmgK6oTIlH3ck_hvvUHBeod3w)

如果PITR的目标时间，对应的归档已经备份，那么在恢复时，不会复用本地归档文件，具体流程如下：

1. 将用户传入的时间，转换为目标scn（时间以数据库所在时区为准）
1. 在catalog里搜索对应DBID的数据库备份集，该备份集的scn小于目标scn，并且最接近目标scn。如果没有找到，则报错
1. 恢复该数据库备份集
1. 恢复目标scn之前的归档备份，有多少恢复多少
1. 尝试复用本地归档，只复用到目标scn之前
1. 执行alter database open resetlogs


###   [4.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    scn转换

由于yasrman的时区，可能和DB的时区不一样，而timestamp到scn的转换，依赖于时区，因此需要在DB端进行scn转换。方法是增加一次消息交互，消息类型为  **RMAN_CMD_TIME2SCN**  ，将时间发送到数据库进行转换。

服务端转换scn的代码为：

```
CodResult anhConvRmanTime2Scn(AnkHandler* handler, CsLink* link, CodPointer defPtr)
{
    CodDate  utcTime = codDateTZ2UTC(def->timestamp, attr->timer->timeZoneBias);

    if (utcTime < 0 || utcTime < ANK_SCN_BASE_USECS) {
        COD_SET_ERROR(ERR_ANS_VERIFY_INVALID_TIMESTAMP);
        return COD_ERROR;
    }

    AnkScn scn = ANK_GEN_SCN(utcTime, 0);
    return bakSend(&pipe, BAK_MSG_TIME2SCN, (CodChar*)&scn, sizeof(AnkScn));
}
```

  


###   [4.3 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)    归档恢复

全库备份恢复之后，数据库处于mount阶段，在备份集里包含的归档文件会恢复出来。并且全库恢复的最后阶段，会尝试注册本地的归档文件（如果有，并且asn连续）。因此在归档恢复的时候，可能有一些归档文件已经注册到数据库的ctrl信息里。

归档恢复的起点是flushpoint点，因为rcyBegin到flushpoint点之间的归档文件，一定在全库备份的备份集中。归档恢复的结束点是scn。

有了起点和结束点，可以直接调用归档恢复的接口即可

###   [4.4 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)    本地归档复用

归档恢复完成后，发送一条消息让数据库开始复用本地归档文件，具体步骤为：

1. 首先确定起始asn，如果有归档日志，则设置最后一个归档日志的asn + 1；如果没有归档，则设为rcyBegin点asn。对每个实例都是如此
1. 开始从起始asn查找本地归档，如果找到了，则对restoreTime，database id进行校验，与数据库的restoreTime，database id相同才可以注册，否则结束注册
1. 注册过程中，如果最后一个归档的next scn已经大于目标scn，则结束注册


###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

1. 使用list backup detail可以看到所有备份集的详细信息，包括scn，asn，可用于判断数据库能恢复到的最大scn
1. 当数据库无法恢复到指定的时间点时，会报错显示当前已经回放到的时间点


###   [4.6 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

不涉及

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

**不涉及**

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

用例路径：anchorbase/test/hatest/testcase/yasrman_pitr.py

|功能|场景|预期|  
|
|---|---|---|---|
|语法|DBID和TAG共用|报错|  
|
|  
|DBID用在非PITR的恢复|报错，必须指定TAG|  
|
|  
|非PITR不指定TAG|报错，必须指定TAG|  
|
|正常功能|所有归档均备份，指定已备份的归档time，清理所有归档后恢复|恢复成功|  
|
|  
|部分归档均备份，指定未备份的归档time，保留未备份的归档后恢复|恢复成功|  
|
|  
|不备份任何归档，保留所有归档后恢复|恢复成功|  
|
|异常场景|指定time太小，没有符合的备份集|报错|  
|
|  
|部分归档均备份，指定未备份的归档time，清理所有归档后恢复|报错，恢复不到目标点|可以继续open resetlogs|
|  
|备份所有归档，但指定的time太大|报错，恢复不到目标点|可以继续open resetlogs|
|  
|执行过restore之后，没有进行全库备份，但是备份了归档，PITR指定了restore之后的时间，进行恢复|报错，恢复不到目标点|restore之后产生的归档，restore time和之前的备份集无法匹配，因此restore之后产生的归档无法恢复|


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

1. doc/产品文档/工具手册/yasrman/yasrman使用指导.md   （语法，PITR注意事项）
1. doc/产品文档/参考手册/错误码.md   （新增错误码）


##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

1. 支持跨restore time的PITR，即使restore之后没来得及做全库备份，也可以用之前的备份集加上restore后新产生的归档日志去恢复。
1. PITR整体进度，目前只能看到全库恢复，归档恢复的进度，看不到recovery的进度。并且全库恢复和归档恢复是独立的。


## Attachments:

## Comments:

|  [](null)  ,与会人：马志宏、张旭涛、高亚宁、刘丹、刘大境    
  会议时间：2024.04.06    
  会议地点：线下会议,会议纪要：,1.单机和集群的功能测试保持一致,2.slice不支持pitr，slice文件恢复不全等问题。,Posted by zhangxutao at 四月 07, 2024 11:21|
|---|
