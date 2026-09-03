Created by 李怿, last modified on 十一月 08, 2024

#   [详细设计-YDBRD-31275: Yasdb支持license认证能力](#详细设计-ydbrd-31275-yasdb支持license认证能力)  

IR: [yasdb支持license认证能力](    [https://pingcode.yasdb.com/pjm/items/66b32ade8f5ee191734b1d60](https://pingcode.yasdb.com/pjm/items/66b32ade8f5ee191734b1d60)    ?#YDBRD-31275 yasdb支持license认证能力)

SR: [YashanDB支持License策略] (    [https://pingcode.yasdb.com/pjm/items/66b32ade0ebcbbf6dd5722c6](https://pingcode.yasdb.com/pjm/items/66b32ade0ebcbbf6dd5722c6)    ?#YDBRD-31276 开发任务：YashanDB支持License策略)

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

- 为了限制企业版被渠道大量私自售卖
- 为了更灵活放开版本体验，官网开放企业版下载


###   [1.2 调研文档](#12-调研文档)  

- 产品提供的调研文档：    [License方案](https://conf.yasdb.com/pages/viewpage.action?pageId=156124794)  
- 华为Licene调研：    [华为License构成](https://support.huawei.com/enterprise/zh/doc/EDOC1000079675/2547eeda)  


###   [1.3 需求分析](#13-需求分析)  

1. 官网可以直接下载到试用版，部署成功后为试用版，试用期为90天，有效时间是从安装时开始计时，到期不自动停库
1. 在申请License后，支持试用版在线升级为企业版（或者标准版）。
1. License可以对时间进行限制，正式版License不限期；License可以对部署形态(分布式，单机，共享集群)进行限制;
1. 申请License流程，用户只要提供合同信息，即可申请到对应License文件


###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

##   [2. 接口](#2-接口)  

##   [3. 规格与约束](#3-规格与约束)  

- 高版本的License不支持在低版本的DB上认证
- 分布式暂不支持License，部署时分布式集群不启动License相关任务。
- 不允许sys用户手动修改License系统表，关键信息修改后会造成License不可用
- License过期后限制用户登录操作，且不再支持在线更新License。
- 不支持试用版到试用版的License更新，只支持试用版到企业版，企业版到企业版的更新


##   [4. License信息组成](#4-license信息组成)  

###   [4.1 License明文组成的信息](#41-license明文组成的信息)  

####   [4.1.1 ESN信息](#411-esn信息)  

License的 ESN（Electronic Serial Number） 电子序列号， 采用MD5对该信息进行加密产生固定长度（128位）的字符串。

方案一: 服务器MAC地址（mac地址一台服务器上可能存在多个）

方案二：使用用户的SSH 私钥 （用户重置SSHkey 的时候会变更，在升级License的流程里面做校验时，不匹配时可能需要重新生成）

方案三： 采用操作系统的uuid（基本绑定，除非重装操作系统）

1. License的控制信息
1.     - LICENSE的UUID
    - ESN信息
    - LICENSE的类型：
        - 试用版（TRIAL）
        - 企业版 (ENTERPRISE)
    - 内核版本号
        - YASDB 版本号
    - LICENSE 版本号
    - LICENSE的有效时间 （单位：天）
    - LICENSE的授权时间
    - 授权的部署形态
        - 分布式（Distributed）
        - 共享集群（Cluster）
        - 单机（Standalone）
    - 允许部署的最大节点数(集群部署的规格， 目前暂不考虑实现)
    - 允许最大并发连接数（是否目前最大的workSession的配置参数， 目前暂不考虑实现）



###   [4.2 License明文组成模版](#42-license明文组成模版)  

示例：license.lic

```
#Shenzhen YashanDB Technology Co.,Ltd. 
#All rights reserved.

id=xxxxxxxxxx
esn=FAXXXXXAAAA,AABXXXXXXXFA
type=trial
version=v1
deploy_type=cluster
expired_days=90 #天
db_version=v23.3
max_node=100
max_connection=128
function=预留，目前可不填

sign=xxxxxxxxxxxxx

```

##   [5  LICENSE许可证生成工具（YasLicense）](#5--license许可证生成工具yaslicense)  

##   [5.1 工具代码依赖](#51-工具代码依赖)  

- 依赖Infra中的security模块


##   [5.2  工具命令行设计](#52--工具命令行设计)  

yasboot cluster新增命令，生成esn

```
yasboot cluster esn -h
Usages: yasboot cluster esn [<flags>] <command>

esn command

Flags:
  -h,--help  Show detailed help information.

Commands:
  gen  generate esn

Run 'yasboot cluster esn COMMAND --help' for more information on a command.
--------------------------------
yasboot cluster esn gen -h

Usages: yasboot cluster esn gen [<flags>]

generate esn

Flags:
  -h,--help         Show detailed help information.
  -c,--cluster      yasdb cluster name
  -i,--info         esn information, such as '052942bff81140d5819b3b7225efcae2'
  -v,-version       esn version, such as 'v1(default: v1)
```

新增生成yaslicense工具，内部使用，不对外发布，生成license.lic文件

```
yaslicense -h

Usages: yaslicense [<flags>] <command>

yasdb license tools, version: Debug 23.4.0.1-1134-g7a873c2912

Flags:
  -h,--help  Show detailed help information.

Commands:
  license     license command

Run 'yaslicense COMMAND --help' for more information on a command.

-----------------
yaslicense license gen -h

Usages: yaslicense license gen [<flags>]

generate license

Flags:
  -h,--help             Show detailed help information.
  -e,--esn              esn information, such as '052942bff81140d5819b3b7225efcae2'
  -t,--type             license type, such as 'trial'
  -v,-version           license version, such as 'v1'(default: v1)
  -d,--deploy-type      deploy cluster type, such as 'ALL,CE,DE or SE'(default: SE)
     --expired-days     exprired date(default: 90)
     --cluster-version  cluster version, such as 'v23.4'
     --export-path      export path for license
     --max-node         max node of cluster, such as 32
     --max-connection   max connection for cluster, such as 1024
  -f, --function string reserved, not uesd now
```

配置文件采用key-value的形式，参考license.lic文件



yasboot cluster新增命令，更新license

```
yasboot cluster license update -h

Usages: yasboot cluster license update [<flags>]

generate esn

Flags:
  -h,--help      Show detailed help information.
  -c,--cluster   yasdb cluster name
  -u,--username  database user(default: sys)
  -p,--password  passord of database user
  -w,--nowait    do not wait commands result(default: false)
  -d,--child     show task info with children task itself(default: false)
     --disable   shield running progress(default: false)
  -f,--file      The path of license file
```



###   [5.2.1  生成ESN密文信息](#521--生成esn密文信息)  

当前版本考虑采用/etc/machine-id作为服务器的唯一特征。

####   [yasboot cluster esn](#yaslicensegen-esn-gen)  

|入参|类型|是否必选|默认值|取值范围/格式|描述|
|---|---|---|---|---|---|
|cluster|字符串|是|N/A|无|部署的数据库名称|
|info|字符串|否|NULL|不超过256字节|服务器的特征信息，可为NULL，为NULL 时，工具从本地服务获取|
|version|字符串|否|V1|V1|esn版本信息|


|出参|数据类型|描述|
|---|---|---|
|ESN信息加密后的密文|VARCHAR(256)|服务器的特征密文信息|


*Note*  实际写入License文件中的ESN信息是采用SHA256算法生成对info和 版本号的信息的加密信息。

###   [5.2.2 生成LICENSE文件](#522-生成license文件)  

####   [yaslicense license gen](#yaslicensegen-license-gen)  

|入参|类型|是否必选|默认值|取值范围/格式|描述|
|---|---|---|---|---|---|
|esn|字符串|是||不超过4096个字节|服务器的特征信息, 由yasoobt cluster esn gen 命令生成,需要先部署好数据库，再使用该命令。|
|type|字符串|是|ENTERPRISE|TRIAL，ENTERPRISE|License版本类型，TRIAL表示试用版，ENTERPRISE表示企业版。,目前只能|
|version|字符串|是|V1|V1|License版本信息，目前仅支持V1。|
|deploy-type|字符串|是|SE|ALL, CE,DE,SE|数据库的部署类型。|
|expired-days|数值|是|90|10进制|License有效天数|
|cluster-version|字符串|是|V23.4|长度不超过16字节。|数据库的软件版本号。|


以下参数为预留字段

|入参|类型|是否必选|默认值|取值范围/格式|描述|
|---|---|---|---|---|---|
|max-node|数值|否|32||授权的最大节点数|
|max-connection|数值|否|1024||授权最大用户连接数|
|Function|字符串|否||长度不超过256字节|数据库支持的功能选项|


|出参|数据类型|描述|
|---|---|---|
|License 文件|文件|license文件，输出到指定路径中：license.lic|


##   [6 LICENSE加解密](#6-license加解密)  

- 加密算法（对称加密算法）：使用的算法
    - SHA256，SM3 hash 算法
    - 目前考虑采用AES128（采用128位密钥分组加密，密钥固定长度128）加密算法对License明文加密


###   [6.1 加密过程](#61-加密过程)  

####   [6.1.1 生成SM3的密钥](#611-生成sm3的密钥)  

1. 从License明文文件中读取首个ESN信息值
1. 使用SHA256算法生成密文信息作为SM3 HMAC算法的密钥


####   [6.1.2 生成License签名信息](#612-生成license签名信息)  

1. 取License的id，esn, type，expired_days, deploy_types 拼接成为主要签名的明文信息
1. 使用SM3的密钥且使用DB内部支持的HMAC-SM3算法生成主要的签名信息
1. 将签名信息写入License文件中的sign字段。
1. 生成最终的License.lic文件。


修订: yasdb 安全模块还不支持sha256hmac 算法，所以此处不需要密钥生成签名信息，目前只支持SM3 HMAC算法，该算法不需要随机盐

####   [6.1.3 对LICENSE文件的有效性进行验签](#613-对license文件的有效性进行验签)  

1. 在Yasdb内部端采用6.1.1 和 6.1.2章节中的步骤生成签名信息。
1. 生成的签名信息与License文件中的签名信息进行校验，完成验签。


##   [7.YASDB对LICENSE处理](#7yasdb对license处理)  

###   [7.1 LICENSE 系统表设计](#71-license-系统表设计)  

方案一：

|字段名|数据类型|描述|
|---|---|---|
|LICENSE_ID|VARCHAR(128)|LICENSE 唯一ID，使用UUID描述|
|LICENSE_TYPE|VARCHAR(16)|LICENSE类型： 试用版(TRIAL)，企业版(ENTERPRISE)|
|LICENSE_VERSION|VARCHAR(16)|LICENSE 版本号|
|SERVER_VERSION|VARCHAR(16)|内核版本|
|EXPIRED_DAYS|INT|LICENSE的有效期|
|ACCREDIT_DATE|DATE|LICENSE的授权时间，用系统时间|
|DEADLINE|DATE|LICENSE 截止日期，用系统时间|
|CLUSTER_TYPE|VARCHAR(64)|授权的集群类型： 1. 分布式（DISTRIBUTED）, 2. 集群（CLUSTER）, 3. 单机（STANDALONE）|
|CONCURRENCY_USER_NUMBER|BIGINT|最大并发连接数|
|MAX_NODE_COUNT|BIGINT|最大节点数|
|ESN|VARCHAR(256)|设备信息|
|FUNCTION|VARCHAR(1024)|License的对DB的功能限制|
|VERIFY_INFO|VARCHAR(256)|License校验信息|
|LICENSE_SIGN|VARCHAR(2048)|License密文信息|


###   [7.2 LICENSE 校验流程](#72-license-校验流程)  

####   [7.2.1 不同部署形态，用户登陆的校验](#721-不同部署形态用户登陆的校验)  

- 分布式在主MN上做校验


问题:

1. 分布式下登陆流程是在cn上本地就完成登陆认证，无需链接MN，所以登陆时不存在到期提醒
1. 如果分布式下在cn上做校验，可到期拦截报错，但无法正常同步License信息


- 单机部署所有DB节点校验
- 共享集群每个DB节点都校验


####   [7.2.2 部署阶段对LICENSE文件处理](#722-部署阶段对license文件处理)  

![](https://pingcode.yasdb.com/atlas/files/public/67396e1aa1ad9a3311dc951e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQWdFRWdCQUFRQUFBQUFBQUFBQUFJQUFBQUFBUUFBQUFBQUFBQUJBQUFBQUFBZ0FBQUFBQUFBQkFBRUFBQUFBQUFBQUFDQUFBQUNnQUFBQUFBQUFBQUFBUUFvQUFBQUFBQUFJSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFGQUFBQUFBQUJBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ1MzYsImV4cCI6MTc4MjMzNTMzNn0.YhpTyUkz0Yqk0J7Y2sibNkv830oGuLkWT26X-K3yJho)

1. Yasdb启动，前面的启动流程未发生变化，等到启动OPEN_PHASE3阶段。
1. 进入LICENSE校验流程，加载License系统表，通过系统表中是否存在数据作为是否首次启动的条件判断
    1. 首次启动：
        1. 通过生成本地安装信息，即License中的ESN信息。
        1. 生成试用版License，将试用版License写入系统表中。
    1. 非首次启动：
        1. 加载License系统表中旧的License信息。
        1. 校验License文件是否有更新
            1. 通过6.1.3校验License文件的有效性
            1. 有效的License文件时，需要更新License
        1. 校验License是否到期，否则继续启动流程
        1. 若License到期后，则启动报错：License expired
1. 启动成功或者失败


####   [7.2.3 Yasdb内部巡检License](#723-yasdb内部巡检license)  

![](https://pingcode.yasdb.com/atlas/files/public/67396e1a8970c2af4f5216aa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQWdFRWdCQUFRQUFBQUFBQUFBQUFJQUFBQUFBUUFBQUFBQUFBQUJBQUFBQUFBZ0FBQUFBQUFBQkFBRUFBQUFBQUFBQUFDQUFBQUNnQUFBQUFBQUFBQUFBUUFvQUFBQUFBQUFJSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFGQUFBQUFBQUJBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ1MzYsImV4cCI6MTc4MjMzNTMzNn0.YhpTyUkz0Yqk0J7Y2sibNkv830oGuLkWT26X-K3yJho)

1. Yasdb启动时YasLicenseMgr模块时启动巡检线程
1. 巡检线程退出标志为Yasdb Stop时停止
1. 判断数据库是否已经open，非open状态下循环继续等待数据库open，不做License巡检
1. 数据库open后，通过加载License系统表的dc，通过DC上的数据进行校验
1. 如果DC加载失败，重复循环加载
1. 加载DC成功后，通过授权时间与当前系统时间进行校验以及License 有效时间进行校验，是否小于30或者是否过期，
1. 小于30天是触发告警日志，过期也告警，按产品文档上描述过期不自动停库。


*NOTE*  :当前均使用单个服务器节点为例，多服务器时，需要收集多台服务器的ESN信息，更新License时，只要更新的服务器在其中任何一台服务器上均可更新。

####   [7.2.4 Yasdb 校验系统重存在的License有效性](#724-yasdb-校验系统重存在的license有效性)  

![](https://pingcode.yasdb.com/atlas/files/public/67396e1aa1ad9a3311dc951f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQWdFRWdCQUFRQUFBQUFBQUFBQUFJQUFBQUFBUUFBQUFBQUFBQUJBQUFBQUFBZ0FBQUFBQUFBQkFBRUFBQUFBQUFBQUFDQUFBQUNnQUFBQUFBQUFBQUFBUUFvQUFBQUFBQUFJSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFGQUFBQUFBQUJBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ1MzYsImV4cCI6MTc4MjMzNTMzNn0.YhpTyUkz0Yqk0J7Y2sibNkv830oGuLkWT26X-K3yJho)

1. License 的有效性校验主要是通过结合database id 和 License id生成的hash值作为校验准则
1. 取系统表中的License id 与当前正在运行的集群中的database id 使用SHA256计算出当前hash值
1. 与数据库中的LicenseVerifyInfo对比，如果出现不一致，可能出现用户恶意篡改系统表
1. 将当前信息License置为过期处理，限制用户登录


####   [7.2.5 License文件有效性校验](#725-license文件有效性校验)  

![](https://pingcode.yasdb.com/atlas/files/public/67396e1a8970c2af4f5216ab/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQWdFRWdCQUFRQUFBQUFBQUFBQUFJQUFBQUFBUUFBQUFBQUFBQUJBQUFBQUFBZ0FBQUFBQUFBQkFBRUFBQUFBQUFBQUFDQUFBQUNnQUFBQUFBQUFBQUFBUUFvQUFBQUFBQUFJSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFGQUFBQUFBQUJBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ1MzYsImV4cCI6MTc4MjMzNTMzNn0.YhpTyUkz0Yqk0J7Y2sibNkv830oGuLkWT26X-K3yJho)

1. 判断License文件是否为试用版
1. 判断License文件的签名是否有效
1. 以上条件均满足判断License有效


##   [9.LICENSE在线更新](#9license在线更新)  

支持在线更新License信息

###   [9.1 设计高级包接口更新License信息](#91-设计高级包接口更新license信息)  

```

dbms_license.update_license(liceseFilePath)


```

|字段名|数据类型|描述|
|---|---|---|
|License file path|VARCHAR(256)|LICENSE 文件的绝对路径，允许为NULL|


####   [License 更新流程](#license-更新流程)  

![](https://pingcode.yasdb.com/atlas/files/public/67396e1aa1ad9a3311dc951e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQWdFRWdCQUFRQUFBQUFBQUFBQUFJQUFBQUFBUUFBQUFBQUFBQUJBQUFBQUFBZ0FBQUFBQUFBQkFBRUFBQUFBQUFBQUFDQUFBQUNnQUFBQUFBQUFBQUFBUUFvQUFBQUFBQUFJSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFGQUFBQUFBQUJBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ1MzYsImV4cCI6MTc4MjMzNTMzNn0.YhpTyUkz0Yqk0J7Y2sibNkv830oGuLkWT26X-K3yJho)

1. 启动更新流程，判断数据库是否open，非open状态下不允许更新License。
1. 判断入参是否为NULL
    1. 为NULL，检查数据库中配置参数INSTANCE_LICENSE_FILE_PATH获取配置路径
        1. 校验License是否有效和是否已更新。
        1. 如果需要更新则刷新系统表和缓存。
    1. 不为NULL，则通过传入的License文件路径，并校验License的有效性。
1. 校验完License文件有效则更新，无效则返回更新失败，校验流程参考（7.2.5）。
1. 校验完成License为正常License时，通过加载配置为文件中的信息后更新到系统表中


*Note*  License 过期后不再支持在线更新，只能通过重启更新License

##   [10. YCM巡检告警](#10-ycm巡检告警)  

Yasdb外部检查通过V$License定期的检查

##   [11. Yasql登陆校验](#11-yasql登陆校验)  

用户登录时，从License管理模块获取是否到期，到期则返回错误：License expired

用户登陆入口直接通过LicenseMgr提供的接口进行判断，若过期则直接返回登录失败，并上述错误。

##   [12. 扩缩容对LICENSE处理](#12-扩缩容对license处理)  

- 缩容：缩容时无影响
- 扩容：扩容时，后续如果License 对节点数量有限制时，需要对具体节点数量在扩容过程中做校验，扩容到最大授权节点数时，需要报错。


##   [13. 升级对LICENSE的处理](#13-升级对license的处理)  

由于会使用license系统表存储校验信息，扩缩容与数据库版本升级均不影响

##   [14. 备份恢复对LICENSE处理](#14-备份恢复对license处理)  

需要单独处理license系统表，刷新license控制信息为90天试用期，用户安装信息为实际的信息

##   [15. License兼容性](#15-license兼容性)  

![](https://pingcode.yasdb.com/atlas/files/public/67396e1a8970c2af4f5216ac/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQWdFRWdCQUFRQUFBQUFBQUFBQUFJQUFBQUFBUUFBQUFBQUFBQUJBQUFBQUFBZ0FBQUFBQUFBQkFBRUFBQUFBQUFBQUFDQUFBQUNnQUFBQUFBQUFBQUFBUUFvQUFBQUFBQUFJSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFGQUFBQUFBQUJBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ1MzYsImV4cCI6MTc4MjMzNTMzNn0.YhpTyUkz0Yqk0J7Y2sibNkv830oGuLkWT26X-K3yJho)

License 兼容性这里不做过多复杂的设计，单纯根据不同的License版本校验不同的License字段。

##   [16. License文件路径配置参数](#16-license文件路径配置参数)  

|配置参数名|默认值|描述|
|---|---|---|
|INSTANCE_LICENSE_FILE_PATH|""|LICENSE文件路径，默认为空串|


##   [16. 数据结构与接口](#16-数据结构与接口)  

```
typedef struct StLicenseManager {
    CodThread       thread;
    SpinLock        lock;
    CodPointer      instance;
    AnlHandler*     handler;
    LicenseContext  licenseCtx
} LicenseMgr;

typedef struct StLicenseContext {
   CodUint32 LicenseVersion;
   ... //其他License控制信息
} LicenseContext;

CodResult     licenseMgrStartUp(LicenseMgr* licenseMgr);
CodResult     licenseMgrStop(LicenseMgr* licenseMgr);
CodResult     licenseMgrVerifyLicense(LicenseMgr* licenseMgr, LicenseContext* newCtx);
CodResult     licenseMgrUpdateLicense(LicenseMgr* licenseMgr, LicenseContext* newCtx);
CodBool       licenseMgrIsExpired(LicenseMgr* licenseMgr);

```

##   [17.DFX](#17dfx)  

###   [17.1 系统视图（V$LICENSE, GV$LICENSE）](#171-系统视图vlicense-gvlicense)  

基于目前已有的视图框架实现，不赘述过多的实现流程，主要关注视图的具体定义

####   [17.1.1 V$LICENSE](#1711-vlicense)  

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


###   [17.2 告警日志](#172-告警日志)  

License 授权小于30天，输出告警日志。

##   [18.自测用例](#18自测用例)  

|用例名称|用例描述|用例预期|备注|
|---|---|---|---|
|单机部署|使用yasboot部署单机集群|部署成功，通过v$License查询出当前为试用版License||
|分布式部署|使用yasboot部署分布式集群|部署成功，通过v$License在mn上能查询出结果||
|共享集群部署|使用yasboot部署共享集群|部署成功，通过v$License在db实例上查询出试用版结果||
|各个部署形态的集群重启|使用yasboot重启各个部署形态的集群|重启成功||
|各个部署形态的集群重启，带正式版License重启|使用yasboot重启各个部署形态的集群|重启成功，通过V$License查询出新的License结果||
|yaslicense工具测试|使用yasboot重启各个部署形态的集群|重启成功，通过V$License查询出新的License结果||
|基础功能无影响|跑通二层所有工程，保证对现有功能不影响，主要时升级，扩缩容，备份恢复等|||


##   [19.资料说明](#19资料说明)  

##   [20.SR拆分](#20sr拆分)  

|标题|类型|工作量评估(人周)|说明|
|---|---|---|---|
|Yasboot 生成ESN|SR|1|ESN信息获取|
|YasLicense工具|SR|1.5|生成License.lic文件|
|Yasdb支持License管理|SR|3||
|License文档说明|SR|0.5||
|自测|SR|2||
|实现license获取流程WEB化|SR|NA||


##   [遗留问题DC 同步机制](#遗留问题dc-同步机制)  

参考：黄杨波 9-27 16:55:43msgExtendIntervalPart

黄杨波 9-27 16:56:08interval分区拓展就是dml做完后要同步更新dc的一个实例

不熟悉，编码时需要花时间消化

##   [21.未来规划](#21未来规划)  

加强LICENSE的特征：

- 保密性
- 防篡改
- 时效性
- 可找回


## Attachments:

[License-License 更新1.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTk4OTcwYzJhZjRmNTIxNmE0IiwicmVmX2lkIjoiNjczOTZlMTk3MjgyMDZlZmI5MmYyNWI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NTM1LCJleHAiOjE3ODI0MTA5MzV9.lw7Nz5jH3Oz8cG4EMvkFfzNKqDnU-nY8bnaCbYcp458)

 (image/jpeg)    


[License-License文件的有效性1.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTlhMWFkOWEzMzExZGM5NTE5IiwicmVmX2lkIjoiNjczOTZlMTk3MjgyMDZlZmI5MmYyNWI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NTM1LCJleHAiOjE3ODI0MTA5MzV9.CTxUpf5LuSRjaPEPG7hauZtSl45XwRtGAJkjX3vxXH8)

 (image/jpeg)    


[License-License文件内容排布.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTlhMWFkOWEzMzExZGM5NTFhIiwicmVmX2lkIjoiNjczOTZlMTk3MjgyMDZlZmI5MmYyNWI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NTM1LCJleHAiOjE3ODI0MTA5MzV9.0XPQAlpxQwCOZT9uq4yKOdoa6CM8BRE4pJE1ht_HKc4)

 (image/jpeg)    


[License-License文件的有效性.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTk4OTcwYzJhZjRmNTIxNmE1IiwicmVmX2lkIjoiNjczOTZlMTk3MjgyMDZlZmI5MmYyNWI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NTM1LCJleHAiOjE3ODI0MTA5MzV9.GPQ6EtcOSXBRbR98g7n4yi2TopBOWCtzoQfdrmGwD40)

 (image/jpeg)    


[License-有效性校验.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTk4OTcwYzJhZjRmNTIxNmE2IiwicmVmX2lkIjoiNjczOTZlMTk3MjgyMDZlZmI5MmYyNWI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NTM1LCJleHAiOjE3ODI0MTA5MzV9.ez4WmqmvtG-99diAiii5plcbIIG5eJTpi7Q5D0jWK6E)

 (image/jpeg)    


[License-Yasdb内部对License巡检.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTk4OTcwYzJhZjRmNTIxNmE3IiwicmVmX2lkIjoiNjczOTZlMTk3MjgyMDZlZmI5MmYyNWI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NTM1LCJleHAiOjE3ODI0MTA5MzV9.DLMcHY82ccevMbGbXQveeykUpvkxpaYjNBILbQFFEow)

 (image/jpeg)    


[License-带License 启动流程.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTlhMWFkOWEzMzExZGM5NTFiIiwicmVmX2lkIjoiNjczOTZlMTk3MjgyMDZlZmI5MmYyNWI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NTM1LCJleHAiOjE3ODI0MTA5MzV9.661MNUHxpqkAIRTZUleCktox7EOocJrTfjKkt985LoU)

 (image/jpeg)    


[License-License 兼容性.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTk4OTcwYzJhZjRmNTIxNmE4IiwicmVmX2lkIjoiNjczOTZlMTk3MjgyMDZlZmI5MmYyNWI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NTM1LCJleHAiOjE3ODI0MTA5MzV9.UbjvX-S1hD4JeSZqK3uRQZwOkVSyXwuI0_fo7l8Ndwo)

 (image/jpeg)    


[License文件内容排布.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTk4OTcwYzJhZjRmNTIxNmE5IiwicmVmX2lkIjoiNjczOTZlMTk3MjgyMDZlZmI5MmYyNWI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NTM1LCJleHAiOjE3ODI0MTA5MzV9.E6o8wjwX0phDz4iPHPBUtTYsAjt44n5SokNVNFIebXQ)

 (image/jpeg)    


[License 更新.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTlhMWFkOWEzMzExZGM5NTFjIiwicmVmX2lkIjoiNjczOTZlMTk3MjgyMDZlZmI5MmYyNWI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NTM1LCJleHAiOjE3ODI0MTA5MzV9.87TdqCtkjZYwQRIrITLoUiOpiCGqMvjenHlp8VlHxTg)

 (image/jpeg)    


[License.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMWFhMWFkOWEzMzExZGM5NTFkIiwicmVmX2lkIjoiNjczOTZlMTk3MjgyMDZlZmI5MmYyNWI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NTM1LCJleHAiOjE3ODI0MTA5MzV9.q3wjTBgFBYe-x8NCZG4sPBNERGLXO6J7jXCBQpUDddQ)

 (image/jpeg)    
