#   1. 概述

YashanDB支持License策略，限制企业版被渠道大量私自售卖，同时提供更灵活放开版本体验，官网开放企业版下载

# 2. 需求分析

SR：  [https://pingcode.yasdb.com/pjm/items/66b32ade8f5ee191734b1d60?](https://pingcode.yasdb.com/pjm/items/66b32ade8f5ee191734b1d60?)  

#YDBRD-31275 yasdb支持license认证能力

设计文档：  [YasdbLicense设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=167165924)  

## 2.1 功能点分析

1.部署成功后自动安装试用版License，从安装开始计时有效期90填，到期不停库

2.支持申请License，从试用版升级为企业版

3.企业版license可以对时间和部署形态进行限制

4.License的控制信息

- LICENSE的UUID
- ESN信息    --操作系统的uuid，可以通过  ~~yaslicense esn~~    yasboot cluster esn gen  命令获取
- LICENSE的类型：
    - 试用版（TRIAL）
    - 企业版 (ENTERPRISE)
- 内核版本号
    - YASDB 版本号
- LICENSE 版本号
- LICENSE的有效时间 （单位：天）
- LICENSE的授权时间
- 授权的部署形态
    - 分布式（Distributed）  DE
    - 共享集群（Cluster）   CE
    - 单机（Standalone）  SE
- 允许部署的最大节点数(集群部署的规格， 目前暂不考虑实现)
- 允许最大并发连接数（是否目前最大的workSession的配置参数， 目前暂不考虑实现）


5.yaslicense esn gen  根据服务器的特征信息生成esn

|入参|类型|是否必选|默认值|取值范围/格式|描述|
|:---|:---|:---|:---|:---|:---|
|server_info|字符串|是|NULL|不超过256字节|服务器的特征信息，可为NULL，为NULL 时，工具从本地服务获取|
|esn_version|字符串|是|V1|V1|esn版本信息|


|出参|数据类型|描述|
|:---|:---|:---|
|ESN信息加密后的密文|VARCHAR(256)|服务器的特征密文信息|


6.yaslicense license gen 生成企业版license

|入参|类型|是否必选|默认值|取值范围/格式|描述|
|:---|:---|:---|:---|:---|:---|
|EsnInfo|字符串|是||不超过4096个字节|服务器的特征信息, 由ESN gen 命令生成, 多机部署时，需要输入多台服务器的特征信息|
|LicenseType|字符串|是|TRIAL|TRIAL，ENTERPRISE|License版本类型，TRIAL表示试用版，ENTERPRISE表示企业版。|
|LicenseVersion|字符串|是|V1|V1|License版本信息，目前仅支持V1。|
|DeployType|字符串|是|Standalone|ALL, Cluster, Distributed, Standalone, Cluster&Distributed, Cluster&Standalone, Distributed&Standalone|数据库的部署类型。|
|ExpiredDays|int32|是|90|int32格式|License有效天数|
|ClusterVersion|字符串|是|V23.4|长度不超过16字节。|数据库的软件版本号。|


以下参数为预留字段

|入参|类型|是否必选|默认值|取值范围/格式|描述|
|:---|:---|:---|:---|:---|:---|
|MaxNode|数值|否|32||授权的最大节点数|
|MaxConnection|数值|否|1024||授权最大用户连接数|
|Function|字符串|否||长度不超过256字节|数据库支持的功能选项|


|出参|数据类型|描述|
|:---|:---|:---|
|License 文件|文件|License文件，输出到指定路径中：License.lic|


7.新增配置参数en表示License文件路径

|配置参数名|默认值|描述|
|---|---|---|
|INSTANCE_LICENSE_FILE_PATH|""|LICENSE文件路径，默认为空串|


8.新增高级包接口dbms_license.update_license(liceseFilePath)用来更新License信息

|字段名|数据类型|描述|
|---|---|---|
|License file path|VARCHAR(256)|LICENSE 文件的绝对路径，允许为NULL|


9.新增  ~~系统视图V$LICENSE、GV$LICENSE   ~~    新增系统表LICENSE$，需要提供视图查询license信息

|字段名|数据类型|描述|
|---|---|---|
|LICENSE_ID|VARCHAR(256)|License 唯一ID，UUID|
|LICENSE_TYPE|VARCHAR(256)|试用版(TRIAL)，企业版(ENTERPRISE)|
|LICENSE_VERSION|INTE|LICENSE 版本号|
|SERVER_VERSION|VARCHAR(256)|内核版本(即数据库版本号)|
|EXPIRED_DATE|DATE|LICENSE的有效期|
|ACCREDIT_DATE|DATE|LICENSE的授权时间|
|CLUSTER_TYPE|VARCHAR(256)|授权的集群类型： 1. 分布式（DISTRIBUTED）, 2. 集群（CLUSTER）, 3. 单机（STANDALONE）|
|CONCURRENCY_USER_NUMBER|BIGINT|最大并发连接数（SESSION_WORKER 最大可配置数）|


## 2.2 应用场景

更灵活放开版本体验，并且限制企业版被渠道大量私自售卖

## 2.3 约束

- 高版本的License不支持在低版本的DB上认证
- 分布式暂不支持License，部署时分布式集群不启动License相关任务。
- 不允许sys用户手动修改License系统表，关键信息修改后会造成License不可用
- License过期后限制用户登录操作，且不再支持在线更新License。
- 不支持试用版到试用版的License更新，只支持试用版到企业版，企业版到企业版的更新


# 3. 详细测试设计

## 3.1 测试设计方法

参数检查——边界值，等价类

功能验证——场景组合

## 3.2 详细测试设计

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|是|
|长稳|否|
|一致性|否|
|三方测试工具  
(sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|是|
|压力|否|
|性能|否|
|可维护性|否|


**参数检查**

参数名需要刷新

有默认值都可以选填参数

|特性|参数项|检查点|取值|预期|
|---|---|---|---|---|
|yaslicense esn gen|server_info|正常值|本机server_info|根据本机信息生成esn|
||||其他机器server_info|根据填写的机器信息生成esn|
||||NULL|与填写本机信息生成esn相同|
|||异常值|超过256个字符的随机字符串|报错字符串长度超过限制|
|||是否必填|省略参数server_info|报错缺少必填参数server_info|
||esn_version|正常值|V1|正常生成esn信息|
|||异常值|其他任意字符串|报错|
|||是否必填|省略参数esn_version|报错缺少必填参数esn_version|
|yaslicense license gen|EsnInfo|正常值|本机esn|正常生成license文件|
||||多个机器esn|正常生成license文件|
|||异常值|超过4096个字符的随机字符串|报错字符串长度超过限制|
|||是否必填|省略参数EsnInfo|报错缺少必填参数EsnInfo|
||~~LicenseType~~  可以考虑去掉参数|正常值|TRIAL|正常生成  ~~试用版~~     企业版  license文件|
||||ENTERPRISE|正常生成企业版license文件|
|||异常值|其他字符串|报错|
|||是否必填|省略参数LicenseType|报错缺少必填参数LicenseType|
||LicenseVersion|正常值|V1|正常生成license|
||目前没有报错，需要进行校验|异常值|其他字符串|报错未支持版本|
|||是否必填|省略参数LicenseVersion|报错缺少必填参数LicenseVersion|
||DeployType|正常值|~~ALL, ~~  Cluster, Distributed, Standalone,  ~~ Cluster&Distributed, Cluster&Standalone, Distributed&Standalone~~|正常生成对应形态的license文件|
|||异常值|其他字符串|报错部署形态错误|
|||是否必填|省略参数DeployType|报错缺少必填参数DeployType|
||ExpiredDays|正常值|90|可以正常生成license|
||||4,294,967,295|~~可以正常生成无限制天数的license~~,可以正常生成license|
|||异常值|0、-1|报错|
||||不符合整数解析格式的字符串|报错|
||||4,294,967,296|报错|
|||是否必填|省略参数ExpiredDays|报错缺少必填参数ExpiredDays|
||ClusterVersion|正常值|V23.4|可以正常生成license|
|||异常值|超过16字符的字符串|报错字符串长度超过限制|
|||是否必填|省略参数ClusterVersion|报错缺少必填参数ClusterVersion|
||MaxNode|正常值|32|可以正常生成license|
|||异常值|0、-1|报错|
||||其他不符合整数解析格式的字符串|报错|
|||是否必填|省略参数MaxNode|可以正常生成license|
||MaxConnection|正常值|1024|可以正常生成license|
|||异常值|0、-1|报错|
||||其他不符合整数解析格式的字符串|报错|
|||是否必填|省略参数MaxConnection|可以正常生成license|
||Function|正常值|不超过256字符的随机字符串|可以正常生成license|
||||空字符串|可以正常生成license|
|||异常值|超过256字符的随机字符串|报错参数值长度超过限制|
|||是否必填|省略参数Function|可以正常生成license|
|高级包dbms_license.update_license|liceseFilePath|正常值|填写正确的企业版license文件路径|可以正常更新license|
|||异常值|空字符串|报错文件不存在|
||||错误的路径| 报错文件不存在  
  会再次检查配置参数路径|
|||是否必填|省略参数liceseFilePath|报错缺少必填参数liceseFilePath|


**场景组合**

|测试点|测试项|步骤|预期|
|---|---|---|---|
|起库自动生成试用版license信息|单机|1.部署单机一主二备数据库,2.查询gv$license视图|gv$license视图各字段数据符合预期|
||集群|1.部署三实例共享集群数据库,2.查询gv$license视图|gv$license视图各字段数据符合预期|
|更新license|单机通过配置参数更新license|1.使用yaslicense生成企业版license,2.部署单机一主二备数据库,3.设置各实例INSTANCE_LICENSE_FILE_PATH配置参数为license文件路径,4.重启数据库|数据库重启成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期|
||单机通过高级包更新license|1.使用yaslicense生成企业版license,2.部署单机一主二备数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径|高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期|
||共享集群通过配置参数更新license|1.使用yaslicense生成企业版license,2.部署共享集群三实例数据库,3.设置各实例INSTANCE_LICENSE_FILE_PATH配置参数为license文件路径,4.重启数据库|数据库重启成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期|
||共享集群通过高级包更新license|1.使用yaslicense生成企业版license,2.部署共享集群三实例数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径|高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期|
|数据库形态限制|单机数据库使用非单机类型license|1.使用yaslicense生成企业版license，部署形态填写Cluster,2.部署单机一主二备数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径|报错，更新失败|
|||1.使用yaslicense生成企业版license，部署形态填写Distributed,2.部署单机一主二备数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径|报错，更新失败|
|||~~1.使用yaslicense生成企业版license，部署形态填写Cluster&Distributed~~,~~2.部署单机一主二备数据库~~,~~3.执行高级包dbms_license.update_license，参数填写license文件路径~~|报错，更新失败|
||单机数据库使用包含单机类型license|~~1.使用yaslicense生成企业版license，部署形态填写ALL~~,~~2.部署单机一主二备数据库~~,~~3.执行高级包dbms_license.update_license，参数填写license文件路径~~|高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期|
|||1.使用yaslicense生成企业版license，部署形态填写Standalone,2.部署单机一主二备数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径|高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期|
|||~~1.使用yaslicense生成企业版license，部署形态填写Cluster&Standalone~~,~~2.部署单机一主二备数据库~~,~~3.执行高级包dbms_license.update_license，参数填写license文件路径~~|高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期|
|||~~1.使用yaslicense生成企业版license，部署形态填写Distributed&Standalone~~,~~2.部署单机一主二备数据库~~,~~3.执行高级包dbms_license.update_license，参数填写license文件路径~~|高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期|
||共享集群数据库使用非共享集群类型license|1.使用yaslicense生成企业版license，部署形态填写Distributed,2.部署共享集群三实例数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径|报错，更新失败|
|||1.使用yaslicense生成企业版license，部署形态填写Standalone,2.部署共享集群三实例数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径|报错，更新失败|
|||1.使用yaslicense生成企业版license，部署形态填写 Distributed&Standalone,2.部署共享集群三实例数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径|报错，更新失败|
||共享集群数据库使用含有共享集群类型license|1.使用yaslicense生成企业版license，部署形态填写ALL,2.部署共享集群三实例数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径|高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期|
|||1.使用yaslicense生成企业版license，部署形态填写Cluster,2.部署共享集群三实例数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径|高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期|
|||1.使用yaslicense生成企业版license，部署形态填写Cluster&Distributed,2.部署共享集群三实例数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径|高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期|
|||1.使用yaslicense生成企业版license，部署形态填写Cluster&Standalone,2.部署共享集群三实例数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径|高级包执行成功，查看gv$license视图各实例更新为新的企业版license，各字段符合预期|
|ESN限制,目前没有增加ESN限制，需要对服务器ESN进行限制|license中的esn信息与单机数据库实例所在服务器的esn信息不一致|1.使用yaslicense生成企业版license，填写esn不包含主机所在服务器的esn,2.部署单机一主二备数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径|报错，更新失败|
||license中的esn信息与集群数据库实例所在服务器的esn信息不一致|1.使用yaslicense生成企业版license，填写esn不包含执行更新实例所在服务器的esn,2.部署集群三实例数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径|报错，更新失败|
|版本号限制,目前未作限制|license中的版本号信息与数据库实例的版本号不一致|1.使用yaslicense生成企业版license，填写数据库版本号为V23.3,2.部署单机一主二备数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径|报错，更新失败|
|告警日志,|license剩30天到期时写告警日志|1.使用yaslicense生成企业版license，有效期为90天,2.部署单机一主二备数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径,4.调整系统时间致至有效天数接近剩余30天,5.查看告警日志，等待有效天数剩余不到30天|1.剩余天数多于30天时不写告警日志,2.剩余天数不足30天时写告警日志,检查不会产生多个告警日志|
|||1.使用yaslicense生成企业版license，有效期为90天,2.部署共享集群三实例数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径,4.调整系统时间致至有效天数接近剩余30天,5.查看告警日志，等待有效天数剩余不到30天|1.剩余天数多于30天时不写告警日志,2.剩余天数不足30天时写告警日志|
|过期限制登录|单机数据库license过期限制登录|1.使用yaslicense生成企业版license，有效期为90天,2.部署单机一主二备数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径,4.调整系统时间致至有效天数接近过期,5.登录数据库，等待过期后重新登录数据库|1.接近过期但还没过期时可以登录数据库,2.过期后限制登录数据库|
||共享集群数据库license过期限制登录|1.使用yaslicense生成企业版license，有效期为90天,2.部署共享集群三实例数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径,4.调整系统时间致至有效天数接近剩余30天,5.查看告警日志，等待有效天数剩余不到30天|1.接近过期但还没过期时可以登录数据库,2.过期后限制登录数据库|
|防篡改|限制更新被篡改的license|1.使用yaslicense生成企业版license，有效期为90天,2.手动修改license若干字段,3.部署单机一主二备数据库,4.执行高级包dbms_license.update_license，参数填写license文件路径|报错，更新失败|
|升级|单机数据库升级后可以正常使用license功能|1.部署旧版本单机一主二备数据库,2.升级到新版本，查询gv$license,3.使用yaslicense生成企业版license,4.执行高级包dbms_license.update_license，参数填写license文件路径|1.升级后自动生成试用版licensen信息，gv$license视图各字段数据符合预期,2.可以正常更新企业版license，gv$license视图各字段数据符合预期|
||共享集群数据库升级后可以正常使用license功能|1.部署旧版本共享集群三实例数据库,2.升级到新版本，查询gv$license,3.使用yaslicense生成企业版license,4.执行高级包dbms_license.update_license，参数填写license文件路径|1.升级后自动生成试用版licensen信息，gv$license视图各字段数据符合预期,2.可以正常更新企业版license，gv$license视图各字段数据符合预期|
|扩容|单机数据库扩容后可以正常使用license功能|1.使用yaslicense生成企业版license,2.部署单机一主二备数据库,3.执行高级包dbms_license.update_license，参数填写license文件路径,4.执行扩容，新增备节点，登录备节点查询v$license视图|扩容成功，v$license视图信息与主节点v$license视图一致|


# 4. 测试用例

  [YDBRD-31275 YashanDB支持License策略文本用例](https://pingcode.yasdb.com/wiki/spaces/YAS/pages/67569909d2baff0fd55ad3f7)  

# 5. 测试框架设计

yastest_dfx测试框架

# 6. 测试环境说明

|IP|内存|磁盘空间|磁盘类型|CPU|操作系统|
|:---|:---|:---|:---|:---|:---|
|192.168.3.198|32G|700G|SSD|8核|centos7.0|
|192.168.3.140|32G|900G|SSD|8核|centos7.0|


# 7. 工作量评估

工作量：3  *人天*

计划测试完成时间：12/13