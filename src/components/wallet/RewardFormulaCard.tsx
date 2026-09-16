import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronUp, Trophy, Info } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const REWARD_FORMULA = [
  {
    action: 'Đăng ký mới',
    emoji: '🎁',
    rewardPerUnit: '50,000 CAMLY',
    dailyLimit: '1 lần duy nhất',
    maxDaily: '50,000 CAMLY',
  },
  {
    action: 'Đăng bài',
    emoji: '📝',
    rewardPerUnit: '10,000 CAMLY',
    dailyLimit: '10 bài',
    maxDaily: '100,000 CAMLY',
  },
  {
    action: 'Nhận Reaction',
    emoji: '❤️',
    rewardPerUnit: '1,000 CAMLY',
    dailyLimit: '50 reactions',
    maxDaily: '50,000 CAMLY',
  },
  {
    action: 'Nhận Comment (>20 ký tự)',
    emoji: '💬',
    rewardPerUnit: '2,000 CAMLY',
    dailyLimit: '50 comments',
    maxDaily: '100,000 CAMLY',
  },
  {
    action: 'Được Share bài',
    emoji: '🔄',
    rewardPerUnit: '10,000 CAMLY',
    dailyLimit: '5 shares',
    maxDaily: '50,000 CAMLY',
  },
  {
    action: 'Kết bạn',
    emoji: '👥',
    rewardPerUnit: '10,000 CAMLY',
    dailyLimit: '10 bạn',
    maxDaily: '100,000 CAMLY',
  },
  {
    action: 'Livestream (10-120 phút)',
    emoji: '📺',
    rewardPerUnit: '20,000 CAMLY',
    dailyLimit: '5 sessions',
    maxDaily: '100,000 CAMLY',
  },
];

interface RewardFormulaCardProps {
  defaultOpen?: boolean;
}

export const RewardFormulaCard = ({ defaultOpen = false }: RewardFormulaCardProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base text-gray-800 dark:text-gray-200">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Công Thức Tính Thưởng CAMLY
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30">
                    <TableHead className="font-semibold text-amber-800 dark:text-amber-200">Hành động</TableHead>
                    <TableHead className="font-semibold text-amber-800 dark:text-amber-200 text-right">Thưởng/lần</TableHead>
                    <TableHead className="font-semibold text-amber-800 dark:text-amber-200 text-right hidden sm:table-cell">Giới hạn/ngày</TableHead>
                    <TableHead className="font-semibold text-amber-800 dark:text-amber-200 text-right hidden md:table-cell">Tối đa/ngày</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REWARD_FORMULA.map((item, index) => (
                    <TableRow 
                      key={index}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{item.emoji}</span>
                          <span className="text-gray-700 dark:text-gray-300 text-sm">{item.action}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-amber-600 dark:text-amber-400 font-medium text-sm">
                        {item.rewardPerUnit}
                      </TableCell>
                      <TableCell className="text-right text-gray-600 dark:text-gray-400 text-sm hidden sm:table-cell">
                        {item.dailyLimit}
                      </TableCell>
                      <TableCell className="text-right text-green-600 dark:text-green-400 font-medium text-sm hidden md:table-cell">
                        {item.maxDaily}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Total max daily */}
            <div className="mt-3 p-3 bg-gradient-to-r from-yellow-400/10 to-amber-400/10 rounded-lg border border-yellow-400/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  💰 Tổng thưởng tối đa/ngày:
                </span>
                <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                  500,000 CAMLY
                </span>
              </div>
            </div>

            {/* Info note */}
            <div className="mt-3 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>
                Daily limits áp dụng từ ngày 15/01/2025. Dữ liệu trước đó không bị giới hạn. 
                Admin cần duyệt thưởng trước khi user có thể claim.
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default RewardFormulaCard;
