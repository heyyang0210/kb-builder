Created by 张志华, last modified by  马勇 on 十一月 13, 2024

*cIR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7440009f91eb87f2b0bc](https://pingcode.yasdb.com/ship/ideas/660b7440009f91eb87f2b0bc)      


*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66bdc6528f5ee191734e21ca](https://pingcode.yasdb.com/pjm/items/66bdc6528f5ee191734e21ca)    *? #YDBRD-31633 Ystream支持集群*

开发设计文档：    [YStream支持集群 特性设计 - YashanDB 文档 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=167152414)  

# 1. 概述

本文描述的是Ystream支持集群测试设计。集群多个节点可同时对外提供服务，Ystream支持并行解析集群内所有节点的redo日志，此次测试针对Ystream的多节点日志并行解析、断点续传、事务溢出等功能进行测试，校验多实例执行业务时，日志解析正常、排序准确。

# 2. 需求分析

## 2.1 功能点分析

**集群新增：**

- 集群中各节点可同时/部分同时对外提供服务，Ystream支持多节点多线程并发日志解析；
- 集群结构发生变更时，Ystream日志解析正常；
- Ystream多实例互斥，高级包新增约束；
- Ystream视图v$ystream_server新增字段；
- 主备集群ystream功能验证；
- 性能指标：  tpcc业务下，解析速度 > 60M/s的DML数据量，延迟1s以内  。


**原有单机功能：**

- 部分用例适配主备集群复用。


## 2.2 应用场景

- 多节点并发业务；
- 集群结构变更；
- 断点续传；
- 事务溢出；
- redo日志切换。


## 2.3 约束

**规格：**

1. 最多可以启动32个YStream server
1. YStream server名字最大长度64
1. 最大支持配置100w张表，1w个schema，默认配置为所有表
1. 集群（主备），单机（主备）


**约束：**

1. where条件列不包含LOB列或者LOB格式存储的类型（如8K以上的varchar）
1. 所有节点的 node id 必须配置唯一。
1. DBMS_YSTREAM_ADM的函数（除START，STOP）只能在主库上执行
1. 一个YStream只能同时和一个客户端连接
1. 一个主备组里，不能在多个实例上启动同一个YStream，一个 ystream server 最多与集群某个节点的一组线程对应。
1. 可以在集群内所有节点调用高级包，但有以下约束：
    1. 已经 start 的 server 只能在start的节点上修改状态，如 add table、drop tables、stop，其他节点试图修改时报错。
    1. 如果 start server 的节点离线，同集群内任意节点都可以修改它的状态。
    1. server 的状态必须按照状态图流转：
        1. created→started;
        1. started→stopped;
        1. stoped→started;
        1. stoped→disabled(执行了 drop 操作)
    1. 主备集群时，备机群仅允许执行：start 和 stop 高级包操作。
1. 不支持UDT类型的表
1. 不支持XML，JSON等复杂类型的列
1. 只支持部分DLL（与单机一致）
1. YStream Server需要的归档不会自动清理，可以用Force手动清理


# 3. 详细测试设计

## 3.1 测试设计方法

采用场景法。

## 3.2 详细测试设计

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|是|
|一致性|是|
|三方测试工具(sqltest，sqlancer)|否|
|安全|是|
|DFR|是|
|HA|是|
|压力|是|
|性能|是|
|可维护性|否|


### 3.2.1 功能测试：

功能测试包括两部分：

- 单机主备ystream用例复用——修改用例适配主备集群；
- 集群新增测试，集群业务包括集群支持的所有数据库对象、操作，测试项包括集群结构变更日志解析正确性验证、断点续传、事务溢出、redo日志文件新增/切换、高级包、视图测试，性能测试，压力测试，长稳测试等。


其中，日志解析的正确性主要验证两点：

- 单个实例顺序执行业务，验证日志解析顺序正确；
- 多个实例并发执行业务，验证多实例日志解析正常。


具体测试点如下：

|  
|测试项|测试场景|预期|用例|
|---|---|---|---|---|
|1|集群正常执行业务（包括事务溢出）,业务包括集群支持的所有数据库对象、操作|集群正常，所有实例顺序执行业务，校验日志解析顺序|日志解析顺序正确|ystream_01|
|2||集群正常，所有实例并发执行业务，校验日志解析正常|日志解析正常，无报错|ystream_02|
|3||集群正常，部分实例执行业务，部分实例不执行业务|日志解析正常|ystream_03|
|4||集群正常，部分实例并发执行业务后停止执行，一段时间后继续执行业务，期间其余实例持续执行业务|日志解析正常|ystream_04|
|5||不同实例多个server并发解析|日志解析正常|ystream_limit_01|
|6||关闭归档日志，创建ystream，查看日志解析|日志解析正常|ystream_limit_02|
|||ystream节点使用高级包stop，其他节点start server解析|日志解析正常|ystream_05|
|7|顺序执行业务/并发执行业务（包括事务溢出）,单节点正常/异常退出后，节点再加入，并执行业务|非ystream节点（db主）stop，start后，不执行业务，再执行业务|db停止，其他节点业务继续进行，日志解析正常|ystream_06、07|
|8||非ystream节点（db主）kill ycs和db进程，启动该节点|db备升主，其他节点业务继续进行，日志解析正常|ystream_dfr_01、06|
|9||非ystream节点（非db主）kill db进程|db重新拉起，其他节点业务继续，日志解析正常|ystream_dfr_02、07|
|10||ystream节点（db主）stop，其他节点start|更换ystream节点后，日志解析正常|ystream_dfr_03、08|
|11||ystream节点（db主）存储网down，ystream更换节点stop、start，恢复网络，该节点加入集群|db备升主，其他节点业务继续，更换ystream节点后日志解析正常|ystream_dfr_network_01、03|
|12||ystream节点（非db主）私网down，ystream更换节点stop、start，恢复故障，该节点加入集群|更换ystream节点后日志解析正常|ystream_dfr_network_02、04|
|13|顺序执行业务/并发执行业务（包括事务溢出）,多节点正常/异常退出后，节点再加入，并执行业务|ystream节点（db主和非db主）stop，再start|日志解析正常|ystream_08|
|14||非ystream节点，db主和db备随机故障组合（kill db、kill ycs/db、私网down、存储网down），恢复故障，节点加入集群|故障后，日志解析正常，节点再加入，日志解析正常|ystream_dfr_network_05|
|15||ystream节点，db主和db备随机故障组合（kill db、kill ycs/db、私网down、存储网down），恢复故障，节点加入集群|故障后，日志解析正常，节点再加入，日志解析正常|ystream_dfr_network_06|
|16||所有节点stop，再start|start后，原节点直接连接，更换节点再stop、start|ystream_09|
|17||所有节点随机故障组合（kill db、kill ycs/db、私网down、存储网down），全部down，恢复故障，节点加入集群，再启动节点，启动ystream|重新启动后，日志解析正常|ystream_dfr_network_07|
|18|节点加入集群|非ystream节点start到nomount、mount、open，open后执行业务|各阶段查看日志解析正常|ystream_09|
|19|断点续传（事务包括事务溢出）|顺序启动两个ystream，执行相同业务，第2个ystream kill db，更换ystream节点后，yml传入scn和新的instance_id，启动java继续日志解析|两个ystream日志解析一致|ystream_resume_api|
|20||顺序启动两个ystream，执行相同业务，第2个ystream kill java，不需要更换ystream节点，yaml传入scn，启动java继续日志解析|两个ystream日志解析一致|ystream_resume_db|
|21|事务溢出（增加到故障场景的业务背景中）|单实例顺序执行事务溢出（长时间未提交）--用例复用覆盖test_sdv_YDBRD_26611_ystream_10.py|日志解析顺序准确|-用例复用覆盖test_sdv_YDBRD_26611_ystream_10.py|
|22||多实例并发执行事务溢出（长时间未提交）|日志解析正常|ystream_overflow_age|
|23||单实例顺序执行事务溢出（数据量过大）--用例复用覆盖test_sdv_YDBRD_26611_ystream_08.py|  
|用例复用覆盖test_sdv_YDBRD_26611_ystream_08.py|
|24||多实例并发执行事务溢出（数据量过大）|  
|ystream_overflow_memory|
|25|高级包操作（互斥及故障测试）|多个实例并发执行同名ystream的高级包，如create、drop、start、stop、add_tables、drop_tables、set_parameter|create、start只有一个节点成功，其余的都是start ystream的节点能够操作|ystream_dbms_01|
|26||多个实例并发创建不同名ystream的高级包，如create、drop、start、stop、add_tables、drop_tables、set_parameter|成功|ystream_dbms_01|
|27||实例1执行create，实例2执行add_tables、drop_tables、set_parameter、start，实例1执行高级包操作start、stop、add_tables、drop_tables、set_parameter、drop|实例1执行create，实例2 start成功，实例1执行其他操作失败|ystream_dbms_01|
|28||实例1执行create，实例2执行start、stop等，实例3执行start、stop等|实例1执行create，实例2执行start、stop成功，实例3执行start、stop成功|ystream_dbms_01|
|29||实例1 start ystream，yml配置实例2 listen_ip，启动java|java连接报错|ystream_dbms_01|
|30||实例1两个session并发执行create、drop、start、stop、add_tables、drop_tables、set_parameter|只有1个seesion执行成功|ystream_dbms_02|
|31||其他用户（与高级包创建相同权限，不同权限）进行高级包调用||ystream_dbms_03|
|32||高级包操作时并发其他节点异常退出（kill db、kill ycs/db）|  
执行太快，卡不住点|执行太快，卡不住点|
|33||高级包操作时并发执行节点异常退出（kill db、kill ycs/db）|  
执行太快，卡不住点|执行太快，卡不住点|
|34|多实例redo切换/新增|单节点手动添加redo文件，并进行redo切换到新redo|日志解析正常|ystream_redo_01|
|35||不添加新redo，单节点手动切换redo，并执行多次|日志解析正常|ystream_redo_02|
|36||多节点并发手动添加redo文件，并进行redo切换|日志解析正常|ystream_redo_03|
|37||多节点并发手动切换redo|日志解析正常|ystream_redo_03|
|38|视图测试|v$ystream_server新增字段显示信息准确性判断|各实例查询信息正确|ystream_limit_01|
|39||v$ystream_stat|各实例查询信息正确|ystream_limit_01|
|40||dba_ystream_parameters|各实例查询一致|ystream_limit_01|
|41||dba_ystream_tables|各实例查询一致|ystream_limit_01|
|42|规格约束——适配集群|ystream server最大个数32验证，单实例32个--单机用例复用，多实例并发32个--新增用例|超过32个报错|ystream_limit_01|
|43||ystream中的logminer个数等于集群实例个数验证|logminer线程数与实例个数*并行度一致|ystream_limit_01|
|44||logminer并行度128验证，超出环境限制时的表现|  
内存超出限制时，db被系统kill|手动操作|
|45||ystream server名称长度64验证，大小写、特殊字符等--单机用例复用|超出64报错，支持大小写|单机用例复用|
|46||最大支持配置100w张表，1w个schema，默认配置为所有表||单机用例复用（1w schema，100w表未测试）|
|47|主备集群，主集群多实例并发执行业务|备集群执行高级包的create、drop、start、stop、add_tables、drop_tables、set_parameter|只能执行start、stop，其他报错|test_sdv_cluster_ha_Ystream_001|
|48||主集群create、start server，备集群stop失败；主集群stop server，备集群start server，主集群stop该server成功||test_sdv_cluster_ha_Ystream_002|
|49||主集群create、start server，主集群挂掉，备集群stop失败；备集群failover后，stop server成功||test_sdv_cluster_ha_Ystream_003|
|50||主集群和备集群日志解析对比|主备集群日志解析一致|test_sdv_cluster_ha_Ystream_004|
|51||主集群db主stop，主备集群日志解析对比|主备集群日志解析一致|test_sdv_cluster_ha_Ystream_005|
|52||主集群非ystream节点db主故障（kill db、kill ycs、kill ycs和db、存储网down、私网down），主备集群日志解析对比|主备集群日志解析一致|test_sdv_cluster_ha_Ystream_006|
|53||主集群ystream节点db主故障（kill db、kill ycs、kill ycs和db、存储网down、私网down），更换ystream节点后，主备集群日志解析对比|主备集群日志解析一致|test_sdv_cluster_ha_Ystream_007|
|54||备集群db主故障，db备自动拉起，更换ystream节点，查看主备集群日志解析对比|主备集群日志解析一致|test_sdv_cluster_ha_Ystream_008|
|||主集群创建server，备集群start server，主集群大业务量的事务移除类操作，备集群解析||test_sdv_cluster_ha_Ystream_009|
|55||switchover场景，主集群降备后，java退出，备升主后，start 日志解析|  
|test_sdv_cluster_ha_Ystream_010|
|56|java连接ystream节点的listen_ip网络故障--db的listen_ip|网络延时（使用jdbc接口，默认10s，延时1s，解析正常，延时11s，断连）|实例2的listen_ip和私网分开配置，db的db listen_ip延时|ystream_dfr_network_08（多网卡）|
|57||网络丢包|实例2的listen_ip和私网分开配置，db listen_ip丢包|使用jdbc接口，超时10s，jdbc覆盖|
|58||网络闪断|实例2的listen_ip和私网分开配置，db listen_ip闪断|使用jdbc接口，超时10s，jdbc覆盖|
|59||重复包|实例2的listen_ip和私网分开配置，db listen_ip重复包|使用jdbc接口，超时10s，jdbc覆盖|
|60|ystream内存不足场景|设置stream_pool_size小，ystream使用内存超过该值|  
||


### **3.2.2 性能测试：**

|部署形态|附加日志模式|tpcc配置（60w以上）|预期结果|
|---|---|---|---|
|2实例集群    
    
|all|300仓，50并发，30min|> 60M/s|
|3实例集群|all|300仓，50并发，30min|> 60M/s|
|4实例集群|all|300仓，50并发，30min|> 60M/s|


### 3.2.3 长稳测试：

增加长稳看护：开启日志解析，做业务，7*24解析。

### 3.2.4 压力测试：

业务量大时，测试日志解析情况。

# 4. 测试用例

冒烟用例：

|  
|测试项|测试场景|预期|
|---|---|---|---|
|1|集群正常执行业务|集群正常，所有实例顺序执行业务，校验日志解析顺序|日志解析顺序正确|
|2||集群正常，所有实例并发执行业务，校验日志解析正常|日志解析正常，无报错|
|3||集群正常，部分实例执行业务，部分实例不执行业务|日志解析正常|
|4|顺序执行业务，单节点正常/异常退出后，节点再加入（业务中包含断点续传、跨实例rollback）|ystream节点（db主）stop|更换ystream节点后，日志解析正常|
|5||ystream节点（db主）kill db，db又被拉起|ystream节点db down又被拉起，db备升主，更换ystream节点后日志解析正常|
|6|并发执行业务，单节点正常/异常退出后，节点再加入（业务中包含断点续传、跨实例rollback）|ystream节点（db主）stop|更换ystream节点后，日志解析正常|
|7||ystream节点（db主）kill db，db又被拉起|ystream节点db down又被拉起，db备升主，更换ystream节点后日志解析正常|
|8|顺序执行业务，多节点正常/异常退出后，节点再加入|ystream节点（db主备）stop|更换ystream节点后，日志解析正常|
|9||ystream节点（db主备）kill db，db又被拉起|ystream节点db down又被拉起，db备升主，更换ystream节点后日志解析正常|
|10|并发执行业务，多节点正常/异常退出后，节点再加入|ystream节点（db主备）stop|更换ystream节点后，日志解析正常|
|11||ystream节点（db主备）kill db，db又被拉起|ystream节点db down又被拉起，db备升主，更换ystream节点后日志解析正常|
|12|高级包操作（互斥及故障测试）|多个实例并发执行同名ystream的高级包，如create、drop、start、stop、add_tables、drop_tables、set_parameter|create、start只有一个节点成功，其余的都是start ystream的节点能够操作|
|13||实例1执行create，实例2执行add_tables、drop_tables、set_parameter、start，实例1执行高级包操作start、stop、drop|实例1执行create，实例2 执行成功，实例1执行其他操作失败|
|14||备集群执行高级包的create、drop、start、stop、add_tables、drop_tables、set_parameter|只能执行start、stop，其他报错|
|15|多实例redo切换/新增|单节点手动添加redo文件，并进行redo切换到新redo|日志解析正常|
|16||单节点手动切换redo到新redo，并执行多次|日志解析正常|
|17||多节点并发手动添加redo文件，并进行redo切换|日志解析正常|
|18||多节点并发手动切换redo|日志解析正常|
|19|系统表测试（多实例查询一致、边界值正常）|v$ystream_server|部分列各实例查询不一致|
|20||v$ystream_stat|各实例查询一致|


文本用例，测试过程中细化；自动化用例，测试过程中输出，附件后续添加。

# 5. 测试框架设计

使用ha_regress框架自动化

长稳使用长稳框架

# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|部署|  
|
|操作系统|Linux|


# **7、工作量评估**

1、原有用例适配——2人周    
  2、新增场景测试&自动化——3人周

总计：5人周

  


## Comments:

|  [](null)  ,一、会议时间：2024/11/13 周三 10:00-11:00    
  二、会议地点：线上会议    
  三、会议主持人：张志华    
  四、参会人员：马志宏、马勇、高亚宁、张志华    
  五、会议主题：【YDBRD-31633】Ystream支持集群详细测试设计评审    
  六、会议总结    
  1、集群故障、断点续传背景业务增加事务溢出——长时间未提交和数据量过大    
  2、主备集群测试增加switchover场景测试——主集群降备后，java退出，备集群升主后，启动ystream，日志解析正确    
  3、增加java连接ystream节点listen_ip的网络故障——网络延时、丢包、删除、重复包等    
  4、增加ystream内存不足场景——设置stream_pool_size小于ystream使用内存    
  5、性能测试tpcc（tpmc超过60 w）下，日志解析速度>60 M/s    
  6、故障场景简化，kill进程、私网/存储网down分别覆盖非ystream节点和ystream节点故障场景中    
  7、故障场景：更换ystream节点时，断点续传用例看护传入scn，剩余故障场景不传入scn，日志解析不报错即可    
  8、工作量评估：    
  原有用例适配——2人周    
  新增场景测试&自动化——3人周,Posted by zhangzhihua at 十一月 13, 2024 11:48|
|---|


