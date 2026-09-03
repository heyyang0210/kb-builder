Created by 李怿, last modified on 十一月 12, 2024

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

- 为了限制企业版被渠道大量私自售卖
- 为了更灵活放开版本体验，官网开放企业版下载


###   [1.2 调研文档](#12-调研文档)  

产品提供的调研文档：    [License方案](https://conf.yasdb.com/pages/viewpage.action?pageId=156124794)  

###   [1.3 需求分析](#13-需求分析)  

1. 官网可以直接下载到试用版，部署成功后为试用版，试用期为90天，有效时间是从安装时开始计时，到期直接停库
1. 在申请License后，支持试用版在线升级为企业版（或者标准版），正式版License不限期
1. License可以对时间进行限制，正式版License不限期；License可以对部署形态(分布式，单机，共享集群)进行限制;
1. 申请License流程，用户只要提供合同信息，即可申请到对应License文件


####   [具体使用场景：](#具体使用场景)  

- 部署：没有正式KEY，部署成功后为试用版；部署成功后，试用版/企业版License信息会注册到数据库中，后续重启不需要检查物理的License文件
- 在线升级到企业版（或者标准版）：客户拿到正式版License文件后，执行相应的操作就可以把信息注册到数据库中并生效，只支持升配
- 数据库扩容，缩容：无影响
- 数据库版本升级：无影响
- 重建库：无影响
- 恢复到新库：需要有License才能商业，不然正常恢复出来还是试用版


##   [2. 接口](#2-接口)  

##   [3. 规格与约束](#3-规格与约束)  

##   [4. 特性](#4-特性)  

###   [4.1 YashanDB获得license的过程](#41-yashandb获得license的过程)  

####   [4.1.1 使用工具采集客户ESN信息](#411-使用工具采集客户esn信息)  

- 使用工具执行命令生成用户安装信息文件，用户安装信息文件包含机器特征码，创建时间，安装版本等
    - 用户安装信息是控制license破解成本的关键，要尽量带上能唯一标示用户的信息
- 工具将用户安装信息通过hash算法计算成hash1，另外收集目标服务器的本地ssh公钥信息，进行打包，完成ESN信息收集（ssh公钥 + 用户安装信息）


####   [4.1.2 申请license的流程](#412-申请license的流程)  

- BD收集客户信息，合同信息后，填写license申请电子流
- license申请由CEO审批通过后，由研发工程部使用license生成工具生成license文件
- 由BD将生成的license文件交给客户进行license升级
- 内部license建议通过通过试用版解决，简化处理


####   [4.1.3 使用license生成工具生成license文件](#413-使用license生成工具生成license文件)  

- 使用生成license工具，输入客户的ESN信息，另外生成license控制信息（如：使用期限（试用期90天，不限制FFFFFFFF）；部署形态）
    - license控制信息需要考虑后期的扩展性(如采用预留或者兼容处理的方法)
- 按一定规则拼接客户的 用户安装信息与license控制信息（简单算法可以使用字符串拼接）为hash2
- 使用加密算法，将hash2与ssh公钥生成license文件内容


###   [4.2 YashanDB可以通过两种方式注册license文件](#42-yashandb可以通过两种方式注册license文件)  

####   [4.2.1 直接使用yasdb注册license文件](#421-直接使用yasdb注册license文件)  

- 通常为单机的使用场景
- 直接通过yasdb启动命令带上license文件路径启动


####   [4.2.2 使用yasboot注册license文件](#422-使用yasboot注册license文件)  

- 通过yasboot的命令，注入license文件
- yasboot将license文件的信息，拼到yasdb启动命令中发送给相关实例
    - 单机形态下，发给主实例，备实例初始构建通过主机build database，后续更新license信息通过系统表同步
    - 分布式形态下，只需要发给CN实例（简化设计，CN起不来的场景，分布式集群也基本等于不可用）
    - 共享集群形态下，发给每个实例


###   [4.3 YashanDB的license解密算法设计](#43-yashandb的license解密算法设计)  

- 将license文件的内容，通过算法及ssh私钥解密出hash2
- 将hash2通过逆向算法解密出license控制信息与license携带的用户安装信息hash3
- 用户合法性校验：license携带的用户安装信息hash3可以与本地存储的用户安装信息hash1进行比较，来识别是否是合法的license用户
- license控制信息校验：通过license携带的license控制信息，可以控制软件允许使用的期限，进行试用版与企业版的区分


###   [4.4 yasdb启动时，校验license的流程设计](#44-yasdb启动时校验license的流程设计)  

前置步骤，已经通过yasboot或者直接解压安装的方式完成YashanDB软件在服务器上的部署，license校验的流程图如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396e16a1ad9a3311dc9515/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFvQUFDQUFBQUFRQUFBZ0lBQUFBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjA2NDQsImV4cCI6MTc4MjMzMTQ0NH0.nU_OAXVes9QajkzZfiu2HaVWTO2iJoM4mZ4-B-C0LFc)

- yasdb实例启动，需要校验license的实例角色
    - 单机形态下，校验主实例即可，备实例启动不做校验（减少复杂度），但备升主的流程建议校验
    - 分布式形态下，只需要CN实例进行校验
    - 共享集群形态下，所有实例都进行校验
- yasdb实例启动校验license的流程如下
    - yasdb程序识别license文件的输入情况，将相关信息记录到实例句柄上
    - 数据库第一次启动的校验流程：
        - 存在license信息
            - 解析出license携带的license控制信息与license携带的用户安装信息，同时生成本地用户安装信息
            - 进行用户合法性校验（比较本地用户安装信息与license携带的用户安装信息）
                - 用户合法，将license携带的用户安装信息与license控制信息写到license系统表，完成启动
                - 用户不合法，等价于license不存在（运行日志或者告警提示？），跳转到不存在license信息流程
        - 不存在license信息（试用版）
            - 生成本地的用户安装信息与90天试用的license控制信息，并写入到license系统表
            - 完成启动
- 数据库非第一次启动的校验流程（通常为数据库不允许启动时使用，数据库启动后建议走在线升级license流程）：
    - 存在license信息，走入license升级流程
        - 解析出license携带的license控制信息与license携带的用户安装信息，同时读取license系统表中的license控制信息与用户安装信息
        - 进行用户合法性校验（比较系统表的用户安装信息与license携带的用户安装信息）
            - 用户合法，校验license携带的控制信息与系统表存的license控制信息，如果优，修改系统表，反之不修改
                - 进入license校验流程
            - 用户不合法，等价于license不存在（运行日志或者告警提示？），跳转到不存在license信息流程
    - 不存在license信息，进入license校验流程
    - license校验流程：读取系统表中存储的license控制信息进行校验
        - 校验通过，启动成功
        - 校验不通过，启动失败


###   [4.5 在线升级license流程](#45-在线升级license流程)  

![](https://pingcode.yasdb.com/atlas/files/public/67396e16a1ad9a3311dc9516/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFvQUFDQUFBQUFRQUFBZ0lBQUFBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjA2NDQsImV4cCI6MTc4MjMzMTQ0NH0.nU_OAXVes9QajkzZfiu2HaVWTO2iJoM4mZ4-B-C0LFc)

- 数据库在线升级license流程：
    - 使用高级包执行在线升级license的命令
    - 解析license信息
        - 解析出license携带的license控制信息与license携带的用户安装信息，同时读取license系统表中的license控制信息与用户安装信息
            - 进行用户合法性校验（比较系统表的用户安装信息与license携带的用户安装信息）
                - 用户合法，校验license携带的控制信息与系统表存的license控制信息
                    - 如果优，修改系统表，返回成功
                    - 如果不优，报错返回
                - 用户不合法，报错返回
        - 无法解析出合法的license信息，报错返回


###   [4.6 扩缩容流程 & 数据库版本升级](#46-扩缩容流程--数据库版本升级)  

- 由于会使用license系统表存储校验信息，扩缩容与数据库版本升级均不影响


###   [4.7 重建库](#47-重建库)  

重建库是一个全新的安装流程，与重新安装数据库无差别，参考4.4章的设计

###   [4.8 通过备份恢复新库](#48-通过备份恢复新库)  

需要单独处理license系统表，刷新license控制信息为90天试用期，用户安装信息为实际的信息

##   [5. 安全性设计](#5-安全性设计)  

license需要考虑以下能力的安全：

- 安全算法：需要采用符合安全规范的加密算法
- 备份恢复：备份恢复是需要对license信息进行处理
- license过期设计：license需要有过期功能，license过期后，需要增加提示以及限制DB的使用


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7. SR拆分](#7-sr拆分)  

|标题|类型|工作量评估(人周)|说明|
|---|---|---|---|
|支持采集客户ESN信息的工具|SR|0.5||
|支持license生成工具|SR|0.5||
|yasdb支持license认证能力|SR|4|参见需求分析章节定义的使用场景，支持license的认证算法|
|实现license获取流程WEB化|SR|NA||


##   [8.未来规划](#8未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

  


## Attachments:

[license-online.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTZhMWFkOWEzMzExZGM5NTEzIiwicmVmX2lkIjoiNjczOTZlMTY3MjgyMDZlZmI5MmYyNTk4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzIwNjQ0LCJleHAiOjE3ODI0MDcwNDR9.stZ1s_1lvjV-VARI6P4xkXBndNFH_GGDfFyxzGFYfV4)

 (image/png)    
