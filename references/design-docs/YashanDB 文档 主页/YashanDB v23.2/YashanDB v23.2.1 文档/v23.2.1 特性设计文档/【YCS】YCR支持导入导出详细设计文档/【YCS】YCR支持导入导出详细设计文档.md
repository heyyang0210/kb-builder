Created by 杜宇轩, last modified by  李垠 on 十一月 08, 2024

*IR链接：*    [YDBRD-19938](https://jira.yasdb.com/browse/YDBRD-19938?src=confmacro)    *-*  *YCR盘导入导出*  *完成*

*SR链接：*    [YDBRD-21386](https://jira.yasdb.com/browse/YDBRD-21386?src=confmacro)    *-*  *YCR盘导入导出*  *完成*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#1-%E6%80%BB%E8%BF%B0)  

本特性主要来源于内部需求，升级需要共享集群支持配置参数可以导入导出，且有些参数单独配置起来较为繁琐，一键导入的话相对来说会节省部署的工作量，根据配置文件部署也比命令行更容易维护。

本特性的主要功能就是：1.支持配置文件导入YCR 2.支持导出YCR的配置文件 3.涉及到的参数、打印等的配套修改

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

**在共享集群的环境下，客户想要有一个全局的配置文件直接可以导入YCR，也可以直接从YCR之中导出这个全局的配置文件。YCS的升级需要用到这个配置文件。**

**同时原有的通过命令构建YCR的能力依然要保留可用的路线**

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

*调研文档1：*    [YCR支持导入导出特性调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=141559164)  

*调研文档2：*    [YCR导入导出特性调研文档](/pages/createpage.action?spaceKey=YAS&title=YCR%E5%AF%BC%E5%85%A5%E5%AF%BC%E5%87%BA%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

我们主要参考的友商是Oracle rac的ocr能力以及达梦的dcr能力。他们都有支持导入导出的功能。

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|导入配置文件|ycsctl import src_path工具命令行实现|是|是|
|  
|导入配置命令行|ycsctl set_ycr key value|是|是|
|  
|导出配置文件|ycsctl export dest_path 工具命令行实现|是|是|
|  
|参数校验|导入时，对命令行里的参数做合法性校验|是|是|
|性能|无|  
|否|否|
|可用性|恢复场景|失败时可以重新执行命令|否|是|
|可靠性|故障场景|导入导出失败能有报错，能够重复执行|是|是|
|可维可测|导入成功校验|导入导出的成功与失败会有专门的错误码去承接|是|是|
|安全|并发场景|多个导出同时并发，只能支持一个，别的都失败退出|是|是|
|易用性|help提示|详细命令用法放进help里提示|否|是|
|兼容性|参数名称固定，不可随意修改|----|否|否|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

无

###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无开源依赖，已去scsi

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#2-%E6%8E%A5%E5%8F%A3)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|工具命令|ycsctl import src_path|导入已经导出的配置脚本|是|
|  
|ycsctl set_ycr key value|导入配置文件里的参数|是|
|  
|ycsctl export dest_path|导出配置脚本到指定位置|是|
|  
|创建集群参数改为ycsctl create cluster yascluster -ycsdisk path -o|把voting_disk在create cluster的时候配置|是|
|配置参数|VOTING_DISK，投票盘|启动后生效|是|
|  
|NETWORK_HB_TIMEOUT，网络心跳超时时间|启动后生效|是|
|  
|DISK_HB_KEEP_ALIVE，磁盘心跳保活时间|启动后生效|是|
|错误码|新增错误码ERROR_YCS_YCR_IMPORT|导入失败|是|
|  
|新增错误码ERROR_YCS_YCR_EXPORT|导出失败|是|
|告警|告警描述|----|是/否|
|日志|YCR导入成功（YCR导入脚本已启动）|INFO等级|是|
|  
|YCR导入失败，原因|ERROR等级|是|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

1. ycr的导入的场景主要是备份恢复和升级回退
1. ycr支持导入导出用的是export和import的命令
1. ycr导出的是能够实现原有集群配置部署的全量命令脚本
1. YCR目前只能静态修改，即YCR必须在没有启动的情况下进行导入
1. ycr导入与单条ycr命令并发，最终结果不保证是一个原子操作
1. 导出的文本，如果用户改了其中命令的顺序、语法等原来能校验的错误，会导致部分成功，不保证原子性和回滚到最初状态，也就是说在配置前不校验
1. 不做文件大小、文件一致性、文件格式的校验
1. 扩缩容或者修改参数值的场景，不和升级一起进行，是同版本ycsctl下单独进行修改。这部分的修改需要提前导出备份，以免操作失败无法回退


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#4-%E7%89%B9%E6%80%A7)  

本特性主要着眼于YCR配置的导入与导出，同时进行部分参数的迁移。

本特性引入之后，集群部署将会有两条推荐路线可以走。

推荐路线一：1. 导入YCR配置文件 2.启动集群

推荐路线二：1. create cluster name  -ycsdisk path -o 2. add node 3.add shell 4.导入参数(set config) 5.启动

###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

本节主要是对几个主要设计上的功能点进行拆分

#### 4.1.1 导入配置文件能力

##### 4.1.1.1 命令

ycsctl import src_path

##### 4.1.1.2 主要功能

该命令主要是由ycsctl实现，从目标配置脚本中，顺序执行脚本以达到备份恢复和升级回退的能力。

导入都是离线导入，暂不支持在线导入。

导入实现的是覆盖原有信息。

导入只有在非首次部署时才可以使用，首次部署使用会报错。

##### 4.1.1.3 导入文件格式

  


```
ycsctl create cluster yascluster -ycsdisk path [-o]
ycsctl add node nodename yascs_url
ycsctl add yasdbinstance nodename.yasdbinstancename startshell stopshell monitorshell
ycsctl set_ycr key value
....
```

导入的内容与全量部署一个集群是相同的。

#### 4.1.2 导出配置文件能力

##### 4.1.2.1 命令

ycsctl export dest_path

##### 4.1.2.2 主要功能

该命令主要是由ycsctl实现，从YCR的存储区域按导入的格式导出配置脚本，导出的配置脚本作为备份

#### 4.1.3 导入配置文件中的参数

##### 4.1.3.1 命令

ycsctl set_ycr key value

##### 4.1.3.2 主要功能

该命令主要是由ycsctl实现，直接由命令行来配置YCR，该命令满足2个key，且2个key需要为network_hb_timeout或者disk_hb_keep_alive，两参数缺省可以用默认值。

##### 4.1.3.3 参数校验

主要是校验set的2条参数是否符合我们的需求，以及参数的value值是否合理

#### 4.1.4 原有config中的三个参数移至YCR

##### 4.1.4.1 参数内容

voting_disk和network_hb_timeout以及disk_hb_keep_alive

##### 4.1.4.2 代码修改内容

1.将原有配置文件校验、打印里的信息都移除，校验能力移入YCR导入

2.新增进YCR的block结构体中，同时YCR里的config show里增加相关信息打印

3.初始化ycs时从block里读取对应的参数使用

#### 4.1.5 原有创建集群参数增加配置voting_disk

##### 4.1.5.1 原有命令

ycsctl create cluster yascluster [-o]

##### 4.1.5.2 新命令

ycsctl create cluster yascluster -ycsdisk path [-o]

且ycsdisk为必填项

###   [4.2 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

#### 4.2.1 导入文件（命令）可维可测

1. 导入报错后可再次导入。
1. 导入后的数据可以用ycsctl show config来作为参照印证。
1. 导入后的数据，再次导出，比较是否不同。


#### 4.2.2 导出文件可维可测

1. 导出文件与ycsctl show config来作为参照印证。
1. 导入后的数据，再次导出，比较是否不同。


#### 4.2.3 参数修改迁移后的打印可维可测

1. ycsctl show config增加voting_disk和network_hb_timeout以及disk_hb_keep_alive相关打印，且和导入导出信息一致
1. ycsctl show parameter去除voting_disk和network_hb_timeout以及disk_hb_keep_alive相关打印


###   [4.3 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

#### 4.3.1 导出文件并发安全设计

导出文件读的时候做并发控制，如果尝试加锁加不上，就直接报错退出。YCR公共磁盘区域的锁在去scsi中已经实现，直接调用即可。

#### 4.3.2 不保证的场景

1. 如果这个导入与单条命令并发，最终结果不保证是一个原子操作。
1. 导出的文本，如果用户改了其中命令的顺序、语法等原来能校验的错误，会导致部分成功，不保证原子性和回滚到最初状态，也就是说在配置前不校验。
1. 不做导入导出文件大小、文件一致性、文件格式的校验。


###   [4.4 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

**本特性的周边配合主要是OM侧和测试工程均需要作出一定调整。同时为了升级有一定的设计。**

#### 4.4.1 部署路线调整

1. create cluster 2. add node 3.add shell 4.导入参数(set config) 5.启动

#### 4.4.2 OM侧调整

1. yascs.ini配置参数初始化要做修改，去掉原有的三个配置项voting_disk和network_hb_timeout以及disk_hb_keep_alive
1. 部署增加导入文件或者是新增导入参数的命令


#### 4.4.3 升级/扩缩容、改参数值方面的适配

1. 升级之前，用导出的能力备份一份全量的YCR集群部署脚本，以便升级失败回退。
1. 扩缩容或者是改参数值之前，用导出的能力备份一份全量的YCR集群部署脚本，以便操作失败回退。


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

|自测场景|具体步骤|期望结果|其他|
|---|---|---|---|
|导入配置文件命令，值信息有误|  
|  
|  
|
|  
|参数不填内容|报错内容有误|漏填value|
|  
|参数填写不符合标准值|报错内容有误|错填value|
|并发导出|同时启动多个并发|只成功一个，其他都报错|  
|
|ycsctl show config打印|是否新增三个参数|正常新增三个参数|  
|
|ycsctl show parameter打印|是否减除三个参数|正常减除三个参数|  
|
|导入成功|导入成功之后show config比对参数是否相同|相同|  
|
|导出成功|导出成功之后show config比对参数是否相同|相同|  
|
|导入失败|首次部署YCR使用导入|导入失败报错退出|  
|


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

共享集群/集群服务管理/共享集群配置里去掉原有的三个配置项voting_disk和network_hb_timeout以及disk_hb_keep_alive

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

### 7.1 YCR安全性

参考DCR，初始化的时候设计一些密码INIT DCRDISK disk_path FROM ini_path IDENTIFIED BY password

### 7.2 动态修改 ，配合在线添加、删除节点

计划通过ycsmaster负责修改YCR，然后同步到其他节点，这里参考的是OCR

  


## Comments:

|  [](null)  ,1.ycsctl上的help里面可以考虑把ycr和ycs的help分开。,2.voting_disk还是挪，指定到一个路径，约束一样的路径（软连接实现）,3.node做node_name1，  node_url1,db1类似的。,4.脚本区往上移动。,Posted by duyuxuan at 一月 02, 2024 12:14|
|---|
|  [](null)  ,考虑把导入导出做成备份恢复方式（二进制）,Posted by duyuxuan at 一月 02, 2024 12:36|
|  [](null)  ,最终结论：,1.首次部署，不用导入的能力。新增ycsctl set ycr_config key value的能力，key为voting_disk和network_hb_timeout以及disk_hb_keep_alive。    
  2.导出的能力为根据YCR的参数导出一套ycsctl命令集合。（.sh）    
  3.导入的能力为通过这个导出的命令集合进行备份恢复和升级回退。用旧工具执行导入，即可一键回退。    
  4.升级的场景兼容性问题需要一版本一分析，不直接通过导出的命令去调用。兼容性尽量在设计的时候就考虑，尽量在升级的时候不去做YCR的重建部署。重建部署在升级脚本里完成，可以参考导出的命令集合。    
  5.如果这个导入与单条命令并发，最终结果不保证是一个原子操作。    
  6.导出的文本，如果用户改了其中命令的顺序、语法等原来能校验的错误，会导致部分成功，不保证原子性和回滚到最初状态，也就是说在配置前不校验。    
  7.不做文件大小、文件一致性、文件格式的校验。    
  8.扩缩容或者修改参数值的场景，不和升级一起进行，是同版本ycsctl下单独进行修改。这部分的修改需要提前导出备份，以免操作失败无法回退。,Posted by duyuxuan at 一月 02, 2024 17:24|
|  [](null)  ,> ,这里应该是带路径的那个命令  Posted by liyin at 一月 04, 2024 21:12|
|  [](null)  ,voting_disk和network_hb_timeout以及disk_hb_keep_alive key值大小写敏感吗,Posted by liyin at 一月 04, 2024 21:26|
|  [](null)  ,#### 4.2.1 导入文件（命令）可维可测,1. 导入会校验是否为首次部署，不为首次部署会报错。==========这条可以删除了
,Posted by liyin at 一月 04, 2024 21:31|
|  [](null)  ,可以做成不敏感的。逻辑不复杂。,Posted by duyuxuan at 一月 05, 2024 09:58|
