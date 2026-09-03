Created by 韦庭德 on 十二月 20, 2023

# **一.**  ** **  **概述**

支持通过yasminer解析存储在YFS中的数据库文件，包括redo文件、ctrl文件、data文件、arch文件。

# **二.**  ** **  **需求分析**

- yasminer现支持解析  存储在YFS中的数据库文件，包括redo文件、ctrl文件、data文件、arch文件。
- 相比于解析FS文件，yasminer解析YFS文件时不需要额外的启动参数，yasminer会自动根据文件路径判断文件类型，并采取相应的解析方式进行解析。
- yasminer解析  存储在YFS中的  文件时，YFS路径必须是绝对路径，且必须以+开头，否则会当作非YFS路径处理。
- 执行yasminer之前需要配置YASCS_HOME环境变量，使得YASCS_HOME=某个 node 目录


# **三.**  ** **  **测试设计方法**

等价类，正交，场景。

  


# **四.**  ** **  **详细测试设计**

### 启动参数

-r redofile：解析redo文件，arch文件-d datafile：解析data文件-c ctlfile：解析data文件

  
  **实例**

|1    
  2    
  3    
  4    
  5    
  6    
  7    
  8|  `###解析本地文件系统文件，既可以输入相对路径，也可以输入绝对路径`      
    `###相对路径`      
    `yasminer -r redo0_1`      
    `###绝对路径`      
    `yasminer -r /home/qinxiaoyu/test_yasminer/redo0_1`      
    
    `###解析YFS文件，必须输入绝对路径，且路径以+开头`      
    `yasminer -r +DG_0/redo0_1`  |
|:---|:---|


## 约束限制

启动ycs服务，同时启动DB和YFS    
  yasminer支持解析存储在YFS中的数据库文件，包括redo文件、ctrl文件、data文件、arch文件    
  yasminer解析存储在YFS中的文件时，YFS路径必须是绝对路径，且必须以+开头，否则会当作非YFS路径处理    
  执行yasminer之前需要配置YASCS_HOME环境变量

# **五.**  ** **  **测试用例**

|功能|操作|预期|备注|
|---|---|---|---|
|redo、arch文件解析    
    
|-r redofile: yasminer -r +DG0/redo0|正常解析redo文件，显示正常，无乱码|  
|
||-r archfile: yasminer -r +DG0/arch_files|正常解析arch文件|  
|
||头部信息|解析结果redo head包含rstid、first lfn、block size等信息|  
|
||batch信息|解析结果包含lfn , block id , size , space size , part count等信息|  
|
||group信息|解析结果包含 lsn , size , handler's id , encrypt等信息|  
|
||非YFS/异常场景，不以+DG0开头的路径：yasminer -r redo0 相对路径系统文件解析|存在此系统文件则解析成功，系统文件不存在则解析失败|  
|
||非YFS/异常场景，不以+DG0开头的路径：yasminer -r /home/redo0 绝对路径系统文件解析|存在此系统文件则解析成功，系统文件不存在则解析失败|  
|
||非YFS/异常场景：文件不存在或文件名不对|解析失败，报错信息指向明确，无core生成|  
|
|data文件解析|-d datafile: yasminer -d +DG0/undo0|正常解析data文件，显示正常，无乱码|  
|
||datafile head|解析结果包含block size、id , type , lsn , checksum: , change num , isEncrypted , isCompressed等信息|  
|
||space head|解析结果包含id , type , lsn , checksum: , change num , isEncrypted , isCompressed等信息|  
|
||datafile map|解析结果包含id , type , lsn , checksum: , change num , isEncrypted , isCompressed等信息|  
|
||非YFS/异常场景，不以+DG0开头的路径：yasminer -d undo0 相对路径系统文件解析|存在此系统文件则解析成功，系统文件不存在则解析失败|  
|
||非YFS/异常场景，不以+DG0开头的路径：yasminer -d /home/undo0 绝对路径系统文件解析|存在此系统文件则解析成功，系统文件不存在则解析失败|  
|
||非YFS/异常场景，文件不存在或文件名不对|解析失败，报错信息指向明确，无core生成|  
|
|ctrl文件解析|-c ctrlfile: yasminer -c +DG0/ctrlfile0|正常解析ctrl文件，显示正常，无乱码|  
|
|  
|标题信息|解析结果Latest Boot Ctrl: copyNum 3|  
|
|  
|Block|解析结果包含Boot ctrl copy , clsn blockCount , version , isArchive , dbid , createStatus 0    
  database name 'testdb', createTime , role PRIMARY, mode MAXIMUM_PERFORMANCE, charset UTF8|  
|
|  
|非YFS/异常场景，不以+DG0开头的路径：yasminer -c ctrlfile0 相对路径系统文件解析|存在此系统文件则解析成功，系统文件不存在则解析失败|  
|
|  
|非YFS/异常场景，不以+DG0开头的路径：yasminer -c /home/ctrlfile0 绝对路径系统文件解析|存在此系统文件则解析成功，系统文件不存在则解析失败|  
|
|  
|非YFS/异常场景，文件不存在或文件名不对|解析失败，报错信息指向明确，无core生成|  
|


# **六.**  ** **  **测试框架**

  


# **七.**  ** **  **测试环境说明**