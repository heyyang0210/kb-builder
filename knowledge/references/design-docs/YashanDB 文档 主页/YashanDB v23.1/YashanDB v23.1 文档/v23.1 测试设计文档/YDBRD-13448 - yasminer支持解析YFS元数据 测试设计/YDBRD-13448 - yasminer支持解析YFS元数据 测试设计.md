Created by 韦庭德 on 十二月 20, 2023

# **一.**  ** **  **概述**

yfsminer 是专门用于解析 YFS 元数据的工具，目前设计目标是面向研究院内部使用，主要用途是检查 YFS 元数据，辅助 YFS 故障、bug 分析。

# **二.**  ** **  **需求分析**

- 目前 yfsminer 支持解析以下类型数据：
    - disk header
    - disk partner
    - disk bitmap
    - file ctrl
    - 间接 fat
    - dir ctrl
    - redo（暂不支持）
- yfsminer 支持一些参数
-b, block id，value-d, disk path， string-f,   fd， value-g,  diskgroup id， value-s,   block size， value-S,  au size, value-t,   block type, string, 可选以下：        - diskheader : disk header block, size=4K
        - pst : disk patner block, size=4K
        - bitmap : disk bitmap block, size=au_size
        - fctrl : file ctrl block， size=4K
        - indirfctrl : indirect file ctrl block, size=4K
        - redo : redo file, size=8 * au_size
-u,  au id, value-v,  verbose 啰嗦模式-y,  ycr 盘路径，string-h,  显示帮助

  


# **三.**  ** **  **测试设计方法**

等价类，正交，场景。

  


# **四.**  ** **  **详细测试设计**

图中 “需要参数” 中带 “*” 的参数表示有默认值或  yfsminer 可以自动从数据的 header 中获取。

![](https://pingcode.yasdb.com/atlas/files/public/6739698ca1ad9a3311dc7774/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDcwNzksImV4cCI6MTc4MjIxNzg3OX0.fYfSt32PvY6JwR5cNja5ey4aPXp-amq1z75b0p8hxEo)

yfsminer 的基本逻辑如图所示，可以通过不同的参数组合，指定不同的数据来源：

- YCR 盘，解析 YFS 元数据，包括 DiskGroups、FailurGroups、Disks 等信息。只需通过 -y 指定 YCR 盘的路径。
- 磁盘上的 block，支持 Features 中列出的所有 block 类型。
    - 如果只指定 disk，那么会打印磁盘所有的元数据，即： disk header、disk partner、bitmap
    - 否则，需指定 disk(-d) 、au(-u)、block(-b，默认 0)、auSize(-S)、blockSize(-s， 默认 4K)、blockType(-t，默认从 blockHeader 探测)
- 文件中的 block，支持 file ctrl、dir ctrl、redo 等。需指定 dg(-g)、fd(-f)、block(-b, 默认 0)、blockSize(-s, 默认 4K)、blockType(-t, 默认从 blockHeader探测)。


注意：

如果要从文件获取虚拟元数据，应确保 yfssrv 或 yascs 已启动，且 yfsminer 可以获得正确的 $YASCS_HOME 环境变量。

所有虚拟元文件的 block 都可以直接从磁盘获取，获得相同的输出。

  


yfsminer 的数据流： 读取block→解析block。

  


其中 blockType(-t)  可以由 yfsminer 自动探测，有时候 YFS 数据已经出错，那么可以通过 -t 强制决定 block 按该数据类型解释。

# **五.**  ** **  **测试用例**

|功能|操作|预期|备注|
|---|---|---|---|
|解析 YFS 元数据    
    
|yfsminer -y /dev/sde|正常解析YFS元数据，显示正常，无乱码|以下所有场景遍历执行数据库业务前后，验证执行数据库业务前后的解析结果对比;停止DB后，做解析，对比YFS和本地的解析结果|
||解析结果|包含disk、diskgroup、failuregroup等信息；yfsminer 会自动缩略那些重复元素，通过 -v 以啰嗦模式输出完整结果|  
|
||指定的磁盘非YFS原数据存储磁盘|解析失败，报错信息指向明确，无core生成|  
|
||解析参数不对（空值、重复值、异常字符|解析失败，报错信息指向明确，无core生成|  
|
|解析 Disk 元数据|yfsminer -d /dev/sdb|正常解析YFS元数据，显示正常，无乱码|  
|
||解析结果|包含disk head、disk partner、disk bitmap等信息|  
|
||指定的磁盘非Disk 元数据存储磁盘|解析失败，报错信息指向明确，无core生成|  
|
||解析参数不对（空值、重复值、异常字符）|解析失败，报错信息指向明确，无core生成|  
|
|解析磁盘的 block|yfsminer -d /dev/sdb -S 1M|正常解析磁盘的 block，显示正常，无乱码，指定更多当前支持的参数|  
|
||yfsminer -d /dev/sdb -S 1M -s 4K -u 3 -b 1|成功解析YFS 的 1 号文件是超级虚拟元文件，其 ctrl 信息通常在磁盘的 au 3， block 1|  
|
||解析结果|包含block的head、fileCtrl、extends等信息|  
|
||指定的磁盘非YFS block存储磁盘|解析失败，报错信息指向明确，无core生成|  
|
||解析参数不对（空值、重复值、异常字符）|解析失败，报错信息指向明确，无core生成|  
|
|解析虚拟元文件的 block|yfsminer -g 0 -f 1 -s 4K -b 1|正常解析YFS 的 1 号文件本身也保存了所有文件的 ctrl 信息，包括其自身的 ctrl 信息，在 1 号文件的 block ，显示正常，无乱码|依赖 yfssrv 或 yascs，确保它们之一已启动|
||解析结果|包含block的head、fileCtrl、extends等信息|  
|
||指定的磁盘非YFS block存储磁盘|解析失败，报错信息指向明确，无core生成|  
|
||解析参数不对（空值、重复值、异常字符）|解析失败，报错信息指向明确，无core生成|  
|


# **六.**  ** **  **测试框架**

  


# **七.**  ** **  **测试环境说明**

## Attachments: