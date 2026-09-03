Created by 黄思源, last modified on 十月 18, 2024

*详细设计-YDBRD-26427 : OM支持部署时配置yfs建库参数*

*IR链接：YDBRD-XXXX*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/661e3d4dfd997db58adabc9c](https://pingcode.yasdb.com/pjm/items/661e3d4dfd997db58adabc9c)    *? #YDBRD-26427 【OM】部署共享集群时，支持ycs/yfs建库参数配置*

##   [1. 总述](#1-总述)  

OM部署共享集群时，支持yfs相关的参数以配置参数的形式配置。

###   [1.1 需求来源](#11-需求来源)  

产品化需求1、Om支持共享集群部署时可配置ycs/yfs建库参数2、文档体现建库参数

###   [1.2 调研文档](#12-调研文档)  

  [磁盘管理命令 语句 create diskgroup](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%B7%A5%E5%85%B7%E6%89%8B%E5%86%8C/yfscmd/%E7%A3%81%E7%9B%98%E7%AE%A1%E7%90%86%E5%91%BD%E4%BB%A4.html)  

  [崖山文件系统](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E6%A6%82%E5%BF%B5%E6%89%8B%E5%86%8C/%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4%E5%9F%BA%E7%A1%80%E8%AE%BE%E6%96%BD/%E5%B4%96%E5%B1%B1%E6%96%87%E4%BB%B6%E7%B3%BB%E7%BB%9F.html)  

  [状态查看命令](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%B7%A5%E5%85%B7%E6%89%8B%E5%86%8C/yfscmd/%E7%8A%B6%E6%80%81%E6%9F%A5%E7%9C%8B%E5%91%BD%E4%BB%A4.html)  

  [在yfs中创建diskgroup示例](https://conf.yasdb.com/pages/viewpage.action?pageId=119546520)  

  [ycs参数](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/%E9%9B%86%E7%BE%A4%E6%9C%8D%E5%8A%A1%E7%AE%A1%E7%90%86/%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4%E9%85%8D%E7%BD%AE.html)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|om命令行支持修改配置文件|修改配置文件的结构|是|是|
|功能|omweb支持配置|前后端交互|是|是|
|兼容性|om命令行部署共享集群|不支持以前的配置文件的共享集群形态部署（需要在版本说明中说明）|是|是|


##   [2. 接口](#2-接口)  

om命令行：暂无变更。只是生成配置文件的格式有变动

##   [3. 规格与约束](#3-规格与约束)  

暂无

##   [4. 特性](#4-特性)  

###   [4.1 命令行](#41-命令行)  

####   [4.1.1 涉及参数](#411-涉及参数)  

**支持的YCS参数：**

- 直接写到yascs.ini中


**LOG_LEVEL**

**LOG_NUMBER**

**LOG_SIZE**

**RESTART_TIMES**

**RESTART_INTERVAL**

**WAIT_STOP_FIN_TIME**

**_HOST_NAME**  （不暴露给用户填写，对于一个机器上只有一个节点，_HOST_NAME为主机名，不写入到yascs.ini中；一个机器上有多个节点，_HOST_NAME为主机名+节点id）

- 通过ycsctl set来设置


**NETWORK_HB_TIMEOUT**

**DISK_HB_KEEP_ALIVE**

**支持的YFS参数**

参考create diskgroup语句

####   [4.1.2 配置文件变更](#412-配置文件变更)  

```
cluster = "minidb"

[[group]]
  	group_type = "ce"
  	name = "ceg1"
  	# 将原本和group同级的CEDisk和YFSConfig移动到里面，和主备共享集群保持一致，方便维护
  	[group.cedisk]
        data = "/dev/sde" # 这个是创建diskgroup需要的数据盘，默认只有1个FG，1个disk。删掉这一行
        vote = "/dev/sdd"
        ycr = "/dev/sdc"
        
	[group.yfsconfig]
        RECY_INTERVAL = "86400"
        SHM_POOL_SIZE = "2G"
        SYS_AREA_SIZE = "1G"
        YFS_PACKET_SIZE = "1M"
        
    [group.ycsconfig] # 新增YCS参数配置
    	DISK_HB_KEEP_ALIVE = 30
        LOG_LEVEL = "DEBUG"
        LOG_NUMBER = 10
        LOG_SIZE = "20M"
        NETWORK_HB_TIMEOUT = 30
        RESTART_INTERVAL = 30
        RESTART_TIMES = 3
        WAIT_STOP_FIN_TIME = 90
        
  	[group.config]
    	YFS_FORCE_CREATE = false # 这个参数也是和create diskgroup有关，如果是true，则所有的disk都添加force，放在group.diskgroup里
   	[[group.diskgroup]]			# 当前sr仅支持部署的时候创建一个diskgroup
    	name = "DG0"			# diskgroup的名称
    	redundancy = "EXTERNAL" # diskgroup的冗余度，EXTERNAL|NORMAL|HIGH，默认为normal
    	disk_size = "70M"		# disk的大小，省略则为该disk的总大小，同一个diskgroup下的所有disk的size是一样的
    	au_size = "1M" 			# 磁盘组的分配单元大小，可选值1M、4M、8M、16M、32M，默认为1M
    	[[group.diskgroup.failgroup]] # failgroup的数量需要大于等于副本数量
    		name = "DG0_0"
    		disk = ["/volume1", "/volume2"]  # 一个diskgroup中所有failuregroup下的disk数量必须保持一致
    	[[group.diskgroup.failgroup]]
    		name = "DG0_1"
    		disk = ["/volume3", "/volume4"]

```

默认生成的配置文件如下：

```
$ ./bin/yasboot package ce gen -c minidb --local --node 1 --data /dev/sde --vote /dev/sdd --ycr /dev/sdc

```

tips：以下文件只保留关键部分。

```
cluster = "minidb"

[[group]]
  group_type = "ce"
  name = "ceg1"
  [group.cedisk]
    vote = "/dev/sdc"
    ycr = "/dev/sdd"
  [group.ycsfonfig]
    DISK_HB_KEEP_ALIVE = 30
    LOG_LEVEL = "DEBUG"
    LOG_NUMBER = 10
    LOG_SIZE = "20M"
    NETWORK_HB_TIMEOUT = 30
    RESTART_INTERVAL = 30
    RESTART_TIMES = 3
    WAIT_STOP_FIN_TIME = 90
  [group.yfsconfig]
    RECY_INTERVAL = "86400"
    SHM_POOL_SIZE = "2G"
    SYS_AREA_SIZE = "1G"
    YFS_PACKET_SIZE = "1M"
  [group.config]
    CHARACTER_SET = "utf8"
    ISARCHIVELOG = true
    REDO_FILE_NUM = 4
    REDO_FILE_SIZE = "128M"

  [[group.diskgroup]]
    au_size = "1M"
    disk_size = ""
    name = "DG0"
    redundancy = "EXTERNAL"
    yfs_force_create = false

    [[group.diskgroup.failgroup]]
      name = "DG0_0"
      disk = ["/dev/sde"]


```

####   [4.1.3 命令变更](#413-命令变更)  

- **package ce gen**


新增参数：

|参数|含义|
|---|---|
|-fg,--failgroup|故障组的数量，默认是1|


原有参数变更：

|参数|含义|
|---|---|
|--data|共享集群数据盘，  **支持输入多个，使用逗号分割**|


- **package config gen**


新增参数：

|参数|含义|
|---|---|
|-fg,--failgroup|故障组的数量，默认是1|


原有参数变更：

|参数|含义|
|---|---|
|--ce-data|共享集群数据盘，  **支持输入多个，使用逗号分割**|


####   [4.1.2 共享集群部署流程](#412-共享集群部署流程)  

1. 根据diskgroup生成create diskgroup的语句
1. 生成YCS的ini文件时，从配置文件的YCSConfig中获取，忽略对AUTO_START和YCR_DISK的配置（即配置也不生效），为了后续YCS的新增参数om这边可以自动适配，所以不对不存在的参数进行校验。
1. 对于NETWORK_HB_TIMEOUT和DISK_HB_KEEP_ALIVE两个参数，使用ycsctl set_ycr命令设置。
1. 将原来写死的DG0（如yasdb.ini中的dbfiles路径等）改成从diskgroup中获取。
1.     - 部署的时候，都从diskgroup.name中获取。
    - cluster clean --restore，  *--with-arch*   删除归档日志。
    - "+DG0/arch_files"，"+DG0/dbfiles"
    - 改成从yasdb.ini中获取CONTROL_FILES，ARCHIVE_LOCAL_DEST。



```
CREATE DISKGROUP DG2 NORMAL REDUNDANCY 
DISK '/dev/DISK_NAME5' SIZE 70M 
FAILGROUP FG_1 DISK '/dev/DISK_NAME10' NAME disk4 SIZE 70M 
FAILGROUP FG_2 DISK '/dev/DISK_NAME4' SIZE 70M 
ATTRIBUTE 'au_size'='4M';

```

###   [4.2 web](#42-web)  

####   [4.2.2 页面大致变更](#422-页面大致变更)  

1. “磁阵数据存储盘路径”还是保留，默认给用户生成1FG，1disk的diskgroup。
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396d5ca1ad9a3311dc90b8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFJQUFFQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQWdBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2NzYsImV4cCI6MTc4MjMxODQ3Nn0.Ux3jXIlcPi8J2Tj2yWXl2yX9Ks2oQDBDM06FPHF3DxM)




1. 类似有个地方可以让用户配置diskgroup？
1. 这里默认是有1FG1disk，其中的disk是前面用户输入的”赐阵数据存储盘路径“。
1. 这里要支持用户配置多个failgroup。
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396d5ca1ad9a3311dc90b9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFJQUFFQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQWdBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2NzYsImV4cCI6MTc4MjMxODQ3Nn0.Ux3jXIlcPi8J2Tj2yWXl2yX9Ks2oQDBDM06FPHF3DxM)




####   [4.2.2 接口变更](#422-接口变更)  

**结构体变更：**

```
"yashandb": {
    "group": [
        {
            "diskgroup": [ // 新增了diskgroup  “磁盘组”
                {
                    "name": "DG0", // “名称”
                    "redundancy": "EXTERNAL", // “冗余度”，只能取值 EXTERNAL|NORMAL|HIGH 
                    "disk_size": "",  // “磁盘组管理的磁盘大小”
                    "au_size": "1M", // “分配单元大小” 取值 1M 4M 8M 16M 32M
                    "failgroup": [ // “故障组”
                        {
                            "name": "DG0_0" // 名称
                            "disk": [ // 磁盘设备
                                "/dev/sde"
                            ]
                        }
                    ],
                    "yfs_force_create": false // 是否强制安装YFS
                }
            ],
            "cedisk": { // CEDisk移动到group里面，名称从CEDisk改成cedisk
                // 删除了"data": 第3步节点配置信息是否不需要展示"磁阵数据存储盘路径"
                "vote": "/dev/sdd",
                "ycr": "/dev/sdc"
            },
            "yfsconfig": { // YFSConfig从外面移动到里面了，名称从YFSConfig改成yfsconfig
                "RECY_INTERVAL": "86400",
                "SHM_POOL_SIZE": "2G",
                "SYS_AREA_SIZE": "1G",
                "YFS_PACKET_SIZE": "1M"
            },
            "ycsconfig": { // YCSConfig是新增参数
                "LOG_NUMBER": "10",
                "LOG_SIZE": "20M"
            }
        }
    ],
    "table_type": "HEAP"
}

```

1. **获取基础信息**
1. **新建配置**
1. **校验配置文件**
1. **更新配置**
1. **获取sql语句**


```
接口：GET /api/initial/info
返回的新增ycs_params参数：
{
    "content":[
        {
            "parameters":{
                "ycs_params":[
                    {
                        .....
                        // 结构和yfs_params一致
                    }
                ]
            }
        }
    ]
}

```

```
接口：POST /api/cluster/config
入参不变
返回体的yashandb发生变更

```

```
接口：POST /api/cluster/check
入参的yashandb发生变更

```

```
接口：PUT /api/cluster/config
入参的yashandb发生变更

```

```
接口：POST /api/cluster/sql/database
入参变更：删除字段ce_data，新增字段failgroup
{
  // ...
	"ce_data": "/dev/sde", // 这个不需要了
    "diskgroup": { // 新增diskgroup
        "name": "DG0",				// diskgroup名称
        "redundancy": "external",	// 冗余度
        "disk_size": "",			// disk的可用大小，默认为空
        "au_size": "1M", 			// 磁盘组的分配单元
        "failgroup": [				// 故障组
            {
            	"disk": ["/volume1","/volume2"] // disk路径
        	}
        ]
    }
}

```

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

##   [6.资料设计章节](#6资料设计章节)  

##   [7.未来规划](#7未来规划)  

## Attachments:

## Comments:

|  [](null)  ,会议纪要：,时间：2024.4.23 17:00-18:00,1. YFS_FORCE_CREATE 的默认值保持为false。将YFS_FORCE_CREATE 从group.config移动到group.diskgroup。,[[group.diskgroup]],au_size = "1M" ,name = "DG0" ,redundancy = "EXTERNAL" ,disk_size = "",yfs_force_create = false,  
,2. 命令行支持输入多盘。,新增 -fg, --failgroup参数，含义为failgroup的数量，默认为1,--data参数，支持输入多个盘，使用逗号分隔，使用如：--data /volume1,/volume2,/volume3,disk分配到具体哪一个failgroup由om控制,  
,  
,Posted by huangsiyuan at 四月 23, 2024 17:59|
|---|
|  [](null)  ,_HOST_NAME：  不暴露给用户填写，对于一个机器上只有一个节点，_HOST_NAME为主机名，不写入到yascs.ini中；一个机器上有多个节点，  _  HOST_NAME为主机名+节点id,Posted by huangsiyuan at 四月 30, 2024 11:16|
