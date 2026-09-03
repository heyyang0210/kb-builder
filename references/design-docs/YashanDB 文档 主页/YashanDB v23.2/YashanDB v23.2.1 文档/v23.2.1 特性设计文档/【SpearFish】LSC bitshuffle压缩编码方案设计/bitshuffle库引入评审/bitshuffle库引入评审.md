Created by 谢锐, last modified on 一月 24, 2024

# 一、bitshuffle算法介绍

BitShuffle是一种重新排列类型化二进制数据以提高压缩率的算法。    
    [https://github.com/kiyo-masui/bitshuffle](https://github.com/kiyo-masui/bitshuffle)     开源项目以MIT协议提供其python/C实现。    
  支持使用向量化指令快速的实现数据的重排列，同时结合LZ4，ZSTD等压缩算法一起完成对数据的压缩。    
  该项目最典型的应用是在python NumPy库和 HDF5文件格式中，其次Kudu,StarRocks等项目的压缩编码上也有应用。

# 二、bitshuffle在YashanDB中的应用

目前LSC表已开发特性支持对数值等类型在LZ4压缩之前，自动使用bitshuffle进行优化。

从TPCH测试看，对比lz4在同等压缩等级下压缩效果有明显提升，同时压缩和解压速度影响并不大。 对比rle+lz4，其适用性更广。

|Lineitem表列|bitshuffleLz4|rle+lz4|lz4|备注|
|---|---|---|---|---|
|列1 INTEGER|3,008|12,951|6,539|lz4为low|
|列2 INTEGER|13,315|14,014|23,562|  
|
|列3 INTEGER|10382|11,073|21,522|  
|
|列4 INTEGER|2,288|1,591|4,766|  
|


参考：    [bitshuffle测试](https://conf.yasdb.com/pages/viewpage.action?pageId=133584683)  

平台支持：支持x86_64, aarch64，LoongArch64等平台。支持SSE/AVX, NEON等向量化加速。

# 三、bitshuffle算法的引入

bitshuffle虽然是一种公开的编码算法，但是仍然有一定的实现复杂度，YashanDB引入bitshuffle算法的方式主要有三种：

|使用方式|优点|缺点|
|---|---|---|
|直接使用开源的算法库(    [https://github.com/kiyo-masui/bitshuffle](https://github.com/kiyo-masui/bitshuffle)    )，以CPM的方式引入|实现成熟度高，引入成本较低|1. 开源库已经2年时间没有维护，具有安可风险，例如发现的Bug是否能及时修复
1. 无法根据YashanDB的诉求定制，例如指定LZ4的压缩级别
|
|独立实现bitshuffle编码|完全自主可控，可以定制，无任何开源检测风险|实现成本高，有一定稳定周期|
|基于开源库修改，以CPM方式引入（推荐）|引入成本角度，可以定制，风险可控|从自研角度看，还是依赖第三方库|


# 四、评审议题

从开源风险、自主可控、开发成本等角度，确认类似bitshuffle库的推荐引入方式

  


  
