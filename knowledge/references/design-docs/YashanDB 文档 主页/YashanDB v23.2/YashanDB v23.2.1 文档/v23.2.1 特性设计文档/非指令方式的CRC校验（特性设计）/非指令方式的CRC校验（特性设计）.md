Created by 马程飞, last modified by  马志宏 on 十月 31, 2023

SR连接：    [[YDBRD-17801] 支持非指令方式的CRC校验](https://jira.yasdb.com/browse/YDBRD-17801)  

  [YDBRD-21692](https://jira.yasdb.com/browse/YDBRD-21692?src=confmacro)    -  【23.1补丁】物理备份集支持非指令方式的CRC校验  完成

  


#   [一.概述](#一概述)  

不支持CRC指令集计算的机器上的备份集中的页面checksum都是-1，使用备份集在支持指令集计算CRC的机器上恢复报错，因此需要自研实现高效的非指令方式的CRC计算功能。

#   [二.功能特性](#二功能特性)  

- 采用的SLICE_BY_8算法实现


###   [相关参数： DB_BLOCK_CHECKSUM](#相关参数-db-block-checksum)  

- 参数类型：字符串
- 默认值：TYPICAL
- 取值范围/格式：OFF，TYPICAL，FULL
- 参数说明：指定页面的checkSum等级。OFF，不校验页面checksum；TYPICAL，磁盘读的时候校验，磁盘写的时候计算；FULL，TYPICAL的基础上，内存读也校验，内存写也重新计算。
- 修改立即生效：是
- 会话级参数：否
- 只读参数：否


#   [三.测试用例](#三测试用例)  

自测流程：

1.修改代码：生成check sum 为 -1

执行业务，执行备份

2.替换二进制为slice by 8算法计算CRC

第一次：执行备份恢复后执行业务

第二次：直接执行业务

3.替换二进制为指令计算CRC

执行业务，验证是否和slice by 8算法计算所得CRC相同，业务能否正常运行

使用3个包进行二进制替换交替测试算法计算的正确性和旧版本切换新版本的兼容性

#   [四.性能表现](#四性能表现)  

## 性能对比：ut测试Uint64 计算1000万次（指令集计算和SLICE_BY_8的性能比较）

|codCrc32Sse42|codCrc32Default| 都计算且进行比较|
|---|---|---|
|79ms|180ms|840ms(比较结果较耗时)|
|78ms|172ms|841ms|


性能对比结论： SLICE_BY_8算法实现计算速度相较于硬件指令集计算速度下降一半