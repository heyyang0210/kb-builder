Created by 牛亚娜, last modified on 六月 18, 2024

**IR链接：**    [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b03e](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b03e)    **?**    
  **#YASHAN-238 OM支持ycs/yfs建库参数配置**

**关联SR链接：**    [https://pingcode.yasdb.com/pjm/items/661e3d4dfd997db58adabc9c](https://pingcode.yasdb.com/pjm/items/661e3d4dfd997db58adabc9c)    **?**    
  **#YDBRD-26427 【OM】部署共享集群时，支持ycs/yfs建库参数配置**

**开发概要设计文档：**    [【OM】部署共享集群时，支持ycs/yfs建库参数配置](https://conf.yasdb.com/pages/viewpage.action?pageId=150621044)  

# **1. 概述**

场景：集群模式下

1、安装部署过程可对yfs、ycs建库参数配置可视化

2、安装部署过程命令行模式下可配置文件

# **2. 需求分析**

## **2.1 功能点分析**

安装部署过程可对ycs、yfs建库参数进行配置

**涉及变更点：**

1、配置文件层面变更：

- 删除"  CEDisk  "中对于"  data  "的设置
- YFS建DG级别配置参数"  YFS_FORCE_CREATE  "移到"  group.diskgroup  "中
- 新增"  group.diskgroup  "选项，并在其中新增YFS建DG级别配置参数，参数列表如下：


```
name = "DG0" # diskgroup的名称
redundancy = "EXTERNAL" # diskgroup的冗余度，EXTERNAL|NORMAL|HIGH，默认为normal
disk_size = "70M" # disk的大小，省略则为该disk的总大小，同一个diskgroup下的所有disk的size是一样的
au_size = "1M" # 磁盘组的分配单元大小，可选值1M、4M、8M、16M、32M，默认为1M
disk = ["/volume1", "/volume2"]  # 一个diskgroup中所有failuregroup下的disk数量必须保持一致
```

  


- 新增YCS级别配置参数，参数列表如下：（对于后续新增的YCS级别的参数，可自动适配）


```
LOG_LEVEL
LOG_NUMBER 
LOG_SIZE
RESTART_TIMES 
RESTART_INTERVAL
WAIT_STOP_FIN_TIME
NETWORK_HB_TIMEOUT
DISK_HB_KEEP_ALIVE
```

2、命令行层面变更：

**package ce gen**

- 新增fg参数（  -fg,--failgroup  ），用来指定在创建DG时所需要的failgroup的数量
- 修改data参数（--data），支持输入多盘，使用逗号分隔，例："  --data /volume1,/volume2,/volume3  "


**package config gen**

- 新增fg参数（  -fg,--failgroup  ），用来指定在创建DG时所需要的failgroup的数量
- 修改data参数（  --ce-data  ），支持输入多盘，使用逗号分隔，例："  --ce-data   /volume1,/volume2,/volume3  "


3、可视化界面变更：

- 各项操作同配置文件层的变更一致


4、删除归档日志命令的机制变更：

- 执行"cluster clean"操作时实现机制层面从"yfscmd rm -rf +DG0/dbfiles"变更为"drop database"，即会删除dbfiles目录下和DG目录下的所有数据文件


## **2.2 应用场景**

**主要应用场景：**

使用工具进行安装部署时，可自定义ycs/yfs相关参数后进行安装部署，为其提供了入口，无需部署后再次修改，提高了易用性

## **2.3 规格约束**

1、部署形态：共享集群（  非集群模式下拦截）

2、部署方式：命令行+可视化

3、支持的参数类型：YCS参数（YCS普通参数+YCS心跳参数）+YFS参数（YFS普通参数+YFS建DG相关参数）【  仅支持部署时创建一个diskgroup  】

4、节点数：以2节点为规格来进行测试即可，和节点数无关

5、不支持的参数：

- YCS级别配置参数：AUTO_START
- YCS级别配置参数"YCR_DISK"通过"  CEDisk  "中的"  vote  "参数来控制
- YCR级别配置参数"VOTE_DISK"通过"  CEDisk  "中的"  ycr  "参数来控制
- YCS级别配置参数"_HOST_NAME"：OM内部实现，不提供外部入口（多机多实例使用真实hostname，单机多实例使用"真实hostname+id"拼接的模式）


# **3. 详细测试设计**

## **3.1 **  **测试设计方法**

**整体思路：**

- 按照配置参数的测试方法进行测试，但每一个配置参数的修改都要走安装部署流程，安装部署完成后进行基本业务的下发（命令行可修改的参数外其他参数的校验是由数据库内部校验的，OM层只是负责抛出错误）
- 对于命令行变更部分，需要进行语法测试和功能测试
- 有强关联的配置参数，需要考虑2个/多个配置参数一起测试
- 部分比较明确的场景，直接针对性构造场景测试即可
- 对于可视化界面测试，和命令行方式结合，在流程走通的前提下，选取部分有代表性的参数进行测试即可，不需要全量测试


**测试方法：**

- 对于每个配置参数的测试，考虑等价类划分法、边界值法进行测试
- 对于命令行部分的测试，考虑等价类划分法进行测试
- 对于部分关联场景，考虑相对明确的场景法和可能出现错误的错误推测法


**测试验证点：**

- 参数修改为指定值后安装部署流程表现符合预期
- 有效/无效参数命令执行后，表现符合预期
- 安装部署成功后参数值符合预期（通过yasboot命令查看）
- 安装部署成功后下发业务正常
- 可视化安装表现符合预期


## **3.2 详细**  **测试设计**

**参数的测试主要考虑以下几个方面**

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|参数值验证|默认值|越界值-大于最大值|  
|
|  
|最大值|越界值-小于最小值|  
|
|  
|最小值|值为：空，NULL，空串|  
|
|  
|中间值/取值范围内的值|值为：中文，小数，非指定的可选项，#￥#等特殊字符|  
|
|参数值格式验证|大写|格式错误|  
|
|  
|小写|  
|  
|
|  
|大小写混合|  
|  
|
|  
|格式正确|  
|  
|
|功能场景验证|根据相应参数设计场景进行验证|  
|  
|
|其他|设置为无效值后，再设置为有效值|同时设置两次为相同值|  
|
|  
|  
|同时设置两次为不同值|  
|


### 3.2.1 YCS层参数测试

这部分主要测试流程：

- 执行yasboot package命令生成配置文件
- 修改配置文件中的参数值为指定值后，再进行安装部署流程验证
- 安装部署完成后要校验参数值修改是否生效（使用yasboot命令和ycsctl命令查看校验  ）
- 下发相关场景业务验证（YCS/DB启停业务，数据库业务，YFS业务）


|参数名|验证点|有效等价类|无效等价类|备注|
|---|---|---|---|---|
|LOG_LEVEL ,- 默认值：DEBUG
- 取值范围/格式：OFF，FATAL，ERROR，WARN，INFO，DEBUG，TRACE，ALL
|参数值验证|DEBUG|值为：空，NULL，空串|场景验证只做一个基础的验证即可，不做重点测试|
|  
|  
|OFF，FATAL，ERROR，WARN，INFO，DEBUG，TRACE，ALL|值为：中文，小数，非指定的可选项，#￥#等特殊字符|  
|
|  
|参数值格式验证|大写|未使用符号|  
|
|  
|  
|小写|使用其他符号（单引号等）|  
|
|  
|  
|大小写混合|  
|  
|
|  
|  
|使用双引号|  
|  
|
|  
|场景验证|安装部署成功后，校验该值显示正确，下发业务后，日志中可以显示相关格式的日志|  
|  
|
|LOG_NUMBER,- 默认值：10
- 取值范围/格式：[2,10000]
|参数值验证|10|值为：空，NULL，空串|  
|
|  
|  
|2|值为：中文，小数，非指定的可选项，#￥#等特殊字符|  
|
|  
|  
|10000|10001|  
|
|  
|  
|20|1|  
|
|  
|场景验证|安装部署成功后，校验该值显示正确，下发业务后，查看  运行日志文件同时存在的个数可以扩展|  
|  
|
|LOG_SIZE,- 默认值：20M
- 取值范围/格式：[1M,4G]
|参数值验证|20M|值为：空，NULL，空串|  
|
|  
|  
|1M|值为：中文，小数，非指定的可选项，#￥#等特殊字符|  
|
|  
|  
|4G|5G|  
|
|  
|  
|100M|1000K|  
|
|  
|参数值格式验证|大写|未使用符号|  
|
|  
|  
|小写|使用其他符号（单引号等）|  
|
|  
|  
|单位为K|  
|  
|
|  
|  
|使用双引号|  
|  
|
|  
|场景验证|安装部署成功后，校验该值显示正确，下发业务后，查看  运行日志文件的大小符合预期（可以结合LOG_NUMBER进行验证，LOG_SIZE设置极小，LOG_NUMBER设置大一点，观察日志文件大小和文件扩展情况）|  
|  
|
|RESTART_TIMES,- 默认值：3
- 取值范围/格式：[0,100]
|参数值验证|3|值为：空，NULL，空串|  
|
|  
|  
|0|值为：中文，小数，非指定的可选项，#￥#等特殊字符|  
|
|  
|  
|100|101|  
|
|  
|  
|10|-1|  
|
|  
|场景验证|安装部署成功后，校验该值显示正确，触发  数据库实例异常掉线场景  ，观察  重试拉起数据库实例的次数符合预期|  
|  
|
|RESTART_INTERVAL,- 默认值：30
- 取值范围/格式：[0,600]
|参数值验证|30|值为：空，NULL，空串|  
|
|  
|  
|0|值为：中文，小数，非指定的可选项，#￥#等特殊字符|  
|
|  
|  
|600|601|  
|
|  
|  
|10|-1|  
|
|  
|场景验证|安装部署成功后，校验该值显示正确，触发  数据库实例异常掉线场景  ，观察  每次重试拉起数据库实例之后增加等待的时间步长符合预期|  
|  
|
|WAIT_STOP_FIN_TIME,- 默认值：90
- 取值范围/格式：[0,300]
|参数值验证|90|值为：空，NULL，空串|  
|
|  
|  
|0|值为：中文，小数，非指定的可选项，#￥#等特殊字符|  
|
|  
|  
|300|301|  
|
|  
|  
|30|-1|  
|
|  
|场景验证|安装部署成功后，校验该值显示正确，  YCS执行停止数据库脚本之后，等待其完全停止的时间符合预期,0表示一直等待，直到正常停止结束,其它值表示如果该时间后，数据库还未停止将执行强制停止|  
|  
|
|NETWORK_HB_TIMEOUT,- 默认值：30
- 取值范围/格式：  [2,600]
- 网络心跳超时时间
|参数值验证|30|值为：空，NULL，空串|  
|
|  
|  
|2|值为：中文，小数，非指定的可选项，#￥#等特殊字符|  
|
|  
|  
|600|601|  
|
|  
|  
|10|1|  
|
|  
|场景验证|安装部署成功后，校验该值显示正确|  
|  
|
|  
|  
|YCS监控DB，通过kill -19 DB构造，验证日志打印符合预期|  
|  
|
|DISK_HB_KEEP_ALIVE,- 默认值：30
- 取值范围/格式：  [2,600]
- 磁盘心跳超时时间
|参数值验证|30|值为：空，NULL，空串|  
|
|  
|  
|2|值为：中文，小数，非指定的可选项，#￥#等特殊字符|  
|
|  
|  
|600|601|  
|
|  
|  
|10|1|  
|
|  
|场景验证|安装部署成功后，校验该值显示正确|  
|  
|
|  
|  
|通过设置磁盘故障，验证节点表现符合预期|  
|  
|


### 3.2.2 命令行测试

这部分主要是对命令行变更部分，进行语法验证和功能验证

- 语法验证：针对参数的格式和参数值进行验证
- 功能验证：安装部署成功后，dg信息验证，下发相关场景业务验证（YCS/DB启停业务，数据库业务，YFS业务）


|命令行|参数|验证点|有效等价类|无效等价类|备注|
|---|---|---|---|---|---|
|**package ce gen**|-fg,--failgroup|语法验证|格式正确|格式错误|单DG内的failuregroup的数量最大为16|
|  
|  
|  
|设置参数值为1|参数值为17|  
|
|  
|  
|  
|设置参数值为2|参数值为0|  
|
|  
|  
|  
|设置参数值为16|参数值为小数|  
|
|  
|  
|  
|不设置（默认为1）|  
|  
|
|  
|--data|语法验证|格式正确|格式错误|  
|
|  
|  
|  
|disk路径存在|disk路径不存在|  
|
|  
|  
|  
|disk权限正确|disk权限不正确|  
|
|  
|  
|  
|fg配置为1个时，disk个数配置为2个|fg配置为2个时，disk个数配置为1个|  
|
|  
|  
|  
|fg配置为2个时，disk个数配置为2个|disk配置多个且相同|  
|
|**package config gen**,  
|-fg,--failgroup|语法验证|格式正确|格式错误|  
|
|  
|  
|  
|设置参数值为1|参数值为17|  
|
|  
|  
|  
|设置参数值为2|参数值为0|  
|
|  
|  
|  
|设置参数值为16|参数值为小数|  
|
|  
|  
|  
|不设置（默认为1）|  
|  
|
|  
|--ce-data|语法验证|格式正确|格式错误|  
|
|  
|  
|  
|disk路径存在|disk路径不存在|  
|
|  
|  
|  
|disk权限正确|disk权限不正确|  
|
|  
|  
|  
|fg配置为1个时，disk个数配置为2个|fg配置为2个时，disk个数配置为1个|  
|
|  
|  
|  
|fg配置为2个时，disk个数配置为2个|disk配置多个且相同|  
|


### 3.2.3 YFS层参数测试

这部分主要测试流程：

- 执行yasboot package命令生成配置文件
- 修改配置文件中的参数值为指定值后，再进行安装部署流程验证
- 安装部署完成后要校验参数值修改是否生效（使用yasboot命令和yfscmd命令查看校验  ）
- 下发相关场景业务验证（YCS/DB启停业务，数据库业务，YFS业务）


|参数名|验证点|有效等价类|无效等价类|备注|
|---|---|---|---|---|
|name = "DG0"|参数值验证|格式正确|格式错误|  
|
|redundancy = "EXTERNAL" |参数值验证|EXTERNAL | NORMAL | HIGH|其他值|  
|
|  
|  
|格式正确|格式错误|  
|
|  
|  
|大写|  
|  
|
|  
|  
|小写|  
|  
|
|  
|  
|大小写混合|  
|  
|
|disk_size = "70M"|参数值验证|磁盘大小范围内|大于磁盘大小|  
|
|  
|  
|格式正确|格式错误|  
|
|  
|  
|大写|  
|  
|
|  
|  
|小写|  
|  
|
|  
|  
|单位为K|  
|  
|
|  
|  
|设置为空""|  
|  
|
|au_size = "1M"|参数值验证|1M（默认值）、4M、8M、16M、32M|其他值|  
|
|  
|  
|格式正确|格式错误|  
|
|  
|  
|大写|  
|  
|
|  
|  
|小写|  
|  
|
|  
|  
|单位为K|  
|  
|
|  
|  
|设置为空""|  
|  
|
|yfs_force_create |参数值验证|true | false|其他值|om的开发语言限制，必须使用小写格式|
|  
|  
|格式正确|格式错误|  
|
|  
|  
|小写|大写|  
|
|  
|  
|  
|大小写混合|  
|
|[[group.diskgroup.failgroup]],name,disk|参数值验证|格式正确|格式错误|  
|
|  
|  
|配置  两个fg，name相同，每个fg的disk数量和大小相同|配置  一个fg，一个disk，disk不存在|  
|
|  
|  
|配置  两个fg，name不同，每个fg的disk数量和大小相同|配置  一个fg，两个disk，两个disk相同|  
|
|  
|  
|  
|配置  两个fg，每个fg一个disk，disk相同|  
|
|  
|  
|  
|配置  两个fg，每个fg的disk数量不同|  
|
|  
|  
|  
|设置  redundancy为  HIGH时，配置一个fg|  
|


### 3.2.4 可视化安装测试

针对此次变更点，修改相关配置，进行部署验证，重点是可以支持yfs创建dg时使用多盘的验证，对于ycs参数进行基本的验证

|  
|场景|备注|
|---|---|---|
|1|可视化安装验证：所有参数默认值安装成功，校验参数值符合预期|  
|
|2|可视化安装验证：修改YCS参数后，安装部署成功，校验参数值符合预期|  
|
|3|可视化安装验证：修改YFS建库参数后，安装部署成功，校验参数值符合预期|  
|
|4|可视化安装验证：配置两个FG两个disk，disk大小相同，disk数量相同，安装成功|  
|
|5|可视化安装验证：配置两个FG两个disk，disk大小不同，disk数量相同，安装失败|  
|
|6|可视化安装验证：配置两个FG，两个FG的名字相同时，安装报错"YAS-05543 duplicate failgroup name DG0_0"|  
|
|7|可视化安装验证：配置两个FG，每个FG的disk数量不同时，提示报错"每个故障组的磁盘设备的数量应该一致"|  
|
|8|可视化安装验证：配置两个FG，每个FG的disk路径相同时，安装报错"the disk path of data cannot be same"|  
|
|9|可视化安装验证：配置17个FG，提示报错"故障组最多16个"|  
|
|10|可视化安装验证：配置一个FG，磁盘大小大于磁盘实际大小时，安装报错"YAS-05550 the size of disk /dev/mapper/DataDisk_2T must be equal to or less than its actual size"|  
|
|11|可视化安装验证：配置一个FG两个disk，disk大小相同，安装成功|  
|
|12|可视化安装验证：配置一个FG两个disk，disk大小不同，安装报错"YAS-05573 the size of disk /dev/mapper/lun03-1T is not equal to the size of other disks in the current diskgroup"|  
|
|13|可视化安装验证：配置一个FG一个disk，disk路径不存在时，安装报错"YAS-05513 failed to open device /dev/mapper/DataDisk2T, error message errno 2, error message "No such file or directory""|  
|
|14|可视化安装验证：配置一个FG一个disk，FG名字和DG名字相同时，安装成功|  
|
|15|可视化安装验证：配置冗余度为"NORMAL"，配置两个FG，安装成功|  
|
|16|可视化安装验证：配置冗余度为"HIGH"，配置三个FG，安装成功|  
|
|17|可视化安装验证：配置冗余度为"NORMAL"，配置一个FG，提示报错"冗余度为 NORMAL 时，至少配置两个故障组"|  
|


### 3.2.5 删除归档命令测试

机制变更：执行"cluster clean"操作时实现机制层面从"yfscmd rm -rf +DG0/dbfiles"变更为"drop database"，即会删除dbfiles目录下和DG目录下的所有数据文件

针对这块的机制变更增加测试点

1、安装部署集群数据库，下发普通表空间业务，数据文件建在DG目录下，执行yasboot删除归档命令，然后重新安装部署，预期可以部署成功

2、安装部署集群数据库，下发全局/本地临时表空间、全局/本地swap表空间，数据文件建在DG目录下，执行yasboot删除归档命令，然后重新安装部署，预期可以部署成功

### 3.2.6 DFX设计

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|此次测试不涉及，重点关注安装部署部分|
|KT|此次测试不涉及，重点关注安装部署部分|
|长稳|此次测试不涉及，重点关注安装部署部分|
|一致性|此次测试不涉及，重点关注安装部署部分|
|三方测试工具(sqltest，sqlancer)|不涉及sql语法层面的新增/修改|
|安全|不涉及用户密码/用户权限等安全性相关因素|
|DFR|此次测试不涉及，重点关注安装部署部分|
|HA|规格中不支持HA模式|
|压力|此次测试不考虑压力专项，只维护基本功能|
|性能|此次测试不考虑性能专项，只维护基本功能|
|可维护性|是,需要考虑自动化实现方式|
|资料|是,关注本次新增资料说明和资料变更,关注版本变更之后不同版本之间"yashandb.toml"文件内容格式不兼容的相关资料说明|


# **4. 测试用例**

测试设计评审时提供冒烟文本用例

|  
|测试场景|预期|
|---|---|---|
|1|设置YCS层普通参数为有效值后，安装部署集群，部署成功后，校验参数值，下发基本的集群启停操作,LOG_LEVEL    LOG_NUMBER   LOG_SIZE   RESTART_TIMES    RESTART_INTERVAL     WAIT_STOP_FIN_TIME|集群部署成功，参数值为设置值，集群启停操作正常|
|2|设置YCS层心跳参数为有效值后，安装部署集群，部署成功后，校验参数值，下发基本的集群启停操作,NETWORK_HB_TIMEOUT     DISK_HB_KEEP_ALIVE|集群部署成功，参数值为设置值，集群启停操作正常|
|3|通过  **package ce gen**  命令生成配置文件，  -fg,--failgroup配置为2，--data配置两个disk，然后安装部署集群，部署成功后，校验dg,fg信息  (yfscmd show diskgroup，  yfscmd show failgroup，yfscmdshow disk  )|集群部署成功，  dg,  fg信息显示符合预期|
|4|通过  **package config gen**  命令生成配置文件，  -fg,--failgroup配置为2，--ce-data配置两个disk，然后安装部署集群，部署成功后，校验dg,fg信息  (yfscmd show diskgroup，  yfscmd show failgroup，yfscmdshow disk  )|集群部署成功，  dg,  fg信息显示符合预期|
|5|生成默认配置文件后，修改配置文件中redundancy = "NORMAL"，配置两个不同名的  failgroup，每个failgroup配置两个disk  ，  然后安装部署集群，部署成功后，校验dg,fg信息(yfscmd show diskgroup，  yfscmd show failgroup，yfscmdshow disk  )|集群部署成功，  dg,  fg信息显示符合预期|
|6|可视化安装包含两个  failgroup，每个  failgroup配置两个disk  的集群数据库|集群部署成功|


启动测试之前提供文本用例，并完成大部分自动化用例

[YDBRD-26427-OM支持ycs+yfs建库参数配置-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMTg4OTcwYzJhZjRmNTIxMDNiIiwicmVmX2lkIjoiNjczOTZkMTc3MjgyMDZlZmI5MmYxYWZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1Nzc1LCJleHAiOjE3ODIzOTIxNzV9.3aSf-zBcuYrmfukrSZXm-v4dAHH9BofuSmrkpbSpUKk)

# **5. 测试框架设计**

- 如果用例不能实现自动化需要在此标注并说明原因
- 确认使用的测试框架及其满足度


|用例类型|测试框架|用例目录|是否需要新增工程|备注|
|:---|:---|:---|---|:---|
|功能用例|guider|/cluster/testcase/yasboot/install_parameter|需要新增yasft工程，单独维护（两节点工程）|自动化比较耗时，考虑当前接口是否满足需求，不满足时需要新增|


# **6. 测试环境说明**

测试环境：集群两节点环境（yasboot安装部署）

# **7. 工作量评估**

工作量：2人周

计划测试开始时间：2024/05/14

计划测试完成时间：2024/05/27

# **8. TODO**

# **9. 上车分析**

  [Agile_master_L2_Build #4750 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/4750/)  

|  
|失败工程|失败原因|是否通过|
|---|---|---|---|
|1|  [Agile_L2_sa_heap_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/2991/)  |  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_PJTvE9nI&runId=ci_record_E8j4mw0m&lastRunId=ci_record_SZv74Azz&activity=FT)  ,未包含其他特性代码，合入主库即可|pass|
|2|  [Agile_L2_sa_lsc_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/2703/)  |超时,  [Agile_L2_sa_lsc_yasft_arm #2707 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/2707/console)  ,未包含其他特性代码，合入主库即可|pass|
|3|  [Agile_L2_sa_upgrade_FT_2_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_2_docker/3510/)  |公共失败问题，无影响|pass|
|4|  [Agile_L2_sa_tac_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/2576/)  |  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_iPntl64R&runId=ci_record_wqNVOnjJ&lastRunId=ci_record_8A8DVQMl&activity=FT)  ,未包含其他特性代码，合入主库即可|pass|
|5|  [Agile_L2_sa_heap_driver_jdbc_debug_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_jdbc_debug_docker/945/)  |  [jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_jdbc_debug_docker/945/jdbc_5ftest_5freport/](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_jdbc_debug_docker/945/jdbc_5ftest_5freport/)  ,用例不稳定，无影响|pass|
|6|  [Agile_L2_sa_FT_expimp_2](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_expimp_2/696/)  |  [jenkins.yasdb.com/job/Agile_L2_sa_FT_expimp_2/696/exp_5fimp_5freport/](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_expimp_2/696/exp_5fimp_5freport/)  ,公共失败问题，无影响|pass|
|7|  [Agile_L2_cluster_heap_yasft_sa_case_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/2429/)  |  [Agile_L2_cluster_heap_yasft_sa_case_arm #2433 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/2433/)  ,  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_3t2GuTOG&runId=ci_record_76KJSOyS&lastRunId=ci_record_w2EBHoCu&activity=FT)  ,框架中设置该参数值为10000|pass|
|8|  [Agile_L2_cluster_yasft_cluster_case_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/2510/)  |  [Agile_L2_cluster_yasft_cluster_case_arm #2514 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/2514/)  ,  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_AYylcn9j&runId=ci_record_jB9Er9Dc&lastRunId=ci_record_ID7fm3Q1&activity=FT)  ,  [Agile_L2_cluster_yasft_cluster_case_arm #2520 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/2520/)  |pass|
|9|  [Agile_L2_cluster_yasft_ycs_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/2258/)  |创建环境失败，重新构建,  [Agile_L2_cluster_yasft_ycs_arm #2262 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/2262/)  ,  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_OcEOkUsp&runId=ci_record_8lZNWaeO&lastRunId=ci_record_EsSAFdbs&activity=FT)  |pass|
|10|  [Agile_L2_cluster_driver_c_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_driver_c_arm/1613/)  |CI工程未修改配置，重新构建,  [Agile_L2_cluster_driver_c_arm #1618 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_driver_c_arm/1618/console)  |pass|
|11|  [Agile_L2_cluster_driver_odbc_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_driver_odbc_arm/1587/)  |CI工程未修改配置，重新构建,  [Agile_L2_cluster_driver_odbc_arm #1592 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_driver_odbc_arm/1592/)  |pass|
|12|  [Agile_L2_cluster_driver_python_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_driver_python_arm/1588/)  |CI工程未修改配置，重新构建,  [Agile_L2_cluster_driver_python_arm #1593 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_driver_python_arm/1593/)  |pass|
|13|  [Agile_L2_cluster_jdbc_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_jdbc_arm/373/)  |CI工程未修改配置，重新构建,  [Agile_L2_cluster_jdbc_arm #378 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_jdbc_arm/378/)  |pass|
|14|  [Agile_L2_cluster_yasft_muti_difObj_sa_6_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_muti_difObj_sa_6_arm/69/)  |  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_JMy2ntwy&runId=ci_record_AaMYqezC&lastRunId=ci_record_4z2gHYew&activity=FT)  ,框架中设置该参数值为10000|pass|
|15|  [Agile_L2_cluster_yasft_faultpoint_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_faultpoint_arm/88/)  |  [Agile_L2_cluster_yasft_faultpoint_arm #92 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_faultpoint_arm/92/)  ,用例脚本问题，无影响|pass|
|16|  [Agile_L2_dst_lsc_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/1943/)  |超时,  [Agile_L2_dst_lsc_yasft_arm #1947 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/1947/console)  ,未包含其他特性代码，合入主库即可|pass|
|17|  [Agile_L2_dst_HA_Switch_docker](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/3156/)  |  [Allure Report (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/3156/allure/#packages/995fbf5deaa1b6939e00b5fc9e38521d/953471e80b791485/)  ,公共失败问题，无影响|pass|


## Attachments:

[YDBRD-26427-OM支持ycs+yfs建库参数配置-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMTg4OTcwYzJhZjRmNTIxMDNiIiwicmVmX2lkIjoiNjczOTZkMTc3MjgyMDZlZmI5MmYxYWZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1Nzc1LCJleHAiOjE3ODIzOTIxNzV9.3aSf-zBcuYrmfukrSZXm-v4dAHH9BofuSmrkpbSpUKk)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,一、会议时间：2024/5/11  15:30-16:15    
  二、会议地点：腾讯会议    
  三、会议主持人：牛亚娜    
  四、参会人员：瞿蓝孟、黄思源、张丽红、牛亚娜    
  五、会议主题：OM支持YCS/YFS建库参数配置 测试设计评审    
  六、会议总结    
  1、机制变更点：执行"cluster clean"操作时实现机制层面从"yfscmd rm -rf +DG0/dbfiles"变更为"drop database"，针对这块的机制变更增加测试点：    
  （1）安装部署集群数据库，下发表空间业务，数据文件建在DG目录下，执行yasboot删除归档命令，然后重新安装部署集群    
  （2）安装部署集群数据库，通过yfscmd在DG目录下创建数据文件，执行yasboot删除归档命令，然后手动拉起ycs，通过yfscmd命令再次创建前面同名的数据文件    
  2、创建DG使用多盘时，增加磁盘权限正确/不正确的校验    
  3、产品文档中已有说明：单DG内FG数量最大为16个，OM层需要在命令行处加以限制,Posted by niuyana at 五月 16, 2024 09:16|
|---|
