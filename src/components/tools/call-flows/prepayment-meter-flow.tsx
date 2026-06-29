'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lightbulb, ArrowLeft, ArrowRight } from 'lucide-react';

const assessmentQuestions = [
  "Is there anyone in the household who requires a constant supply for health reasons?",
  "Are there any circumstances that prevent the household from safely or reasonably using the prepayment meter?",
  "Have you carried out an assessment of the customer circumstances, including PSR?",
  "Can the customer Top-Up without frequent or prolonged periods of self-disconnection that would cause them significant harm?",
  "Is there someone living permanently within the household who is able to understand how to operate a prepayment meter?",
  "Is there someone within the household who can physically buy top-ups for a prepayment meter, e.g. through the app or at a nearby payment outlet?",
  "Is the meter located in a safe position that is easily accessible at any time of the day?",
  "Is a member of this household physically able to update this meter if needed?",
];

type Answers = { [key: number]: 'Yes' | 'No' | '' };

export interface PrePaymentMeterState {
  assessmentAnswers?: Answers;
  promiseNumber?: string;
  summary?: string;
  assessmentSummary?: string;
}

interface PrePaymentMeterFlowProps {
  onStateChange: (state: PrePaymentMeterState) => void;
}

export function PrePaymentMeterFlow({ onStateChange }: PrePaymentMeterFlowProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [promiseNumber, setPromiseNumber] = useState('');
  const isAssessmentComplete = Object.keys(answers).length === assessmentQuestions.length && Object.values(answers).every(a => a);

  useEffect(() => {
    let summary = 'Pre-payment meter arrangement pending.';
    let assessmentSummary = '';
    
    if (isAssessmentComplete) {
      assessmentSummary = assessmentQuestions
        .map((q, i) => `${q} - ${answers[i]}`)
        .join('\n');
      summary = `Safe & Practicable Assessment completed.`;
      if (promiseNumber) {
        summary += ` Promise number: ${promiseNumber}.`;
      }
    }
    
    onStateChange({
      assessmentAnswers: answers,
      promiseNumber,
      summary,
      assessmentSummary,
    });
  }, [answers, promiseNumber, isAssessmentComplete, onStateChange]);

  const handleAnswerChange = (questionIndex: number, value: 'Yes' | 'No') => {
    setAnswers(prev => ({ ...prev, [questionIndex]: value }));
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < assessmentQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  return (
    <Card className="frosted-glass">
      <CardHeader>
        <CardTitle>Process Flow: Arrange Pre-Payment Meter</CardTitle>
        <CardDescription>
          Guide the customer through the Safe & Practicable Assessment and record the promise number.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Safe & Practicable Assessment</CardTitle>
            <CardDescription>
              Ask the customer the following question.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-semibold">{currentQuestionIndex + 1}. {assessmentQuestions[currentQuestionIndex]}</p>
            <RadioGroup 
              value={answers[currentQuestionIndex] || ''} 
              onValueChange={(value: 'Yes' | 'No') => handleAnswerChange(currentQuestionIndex, value)}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Yes" id={`q${currentQuestionIndex}-yes`} />
                <Label htmlFor={`q${currentQuestionIndex}-yes`}>Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="No" id={`q${currentQuestionIndex}-no`} />
                <Label htmlFor={`q${currentQuestionIndex}-no`}>No</Label>
              </div>
            </RadioGroup>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={prevQuestion} disabled={currentQuestionIndex === 0}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Previous
            </Button>
            <div className="text-sm text-muted-foreground">
              Question {currentQuestionIndex + 1} of {assessmentQuestions.length}
            </div>
            <Button onClick={nextQuestion} disabled={currentQuestionIndex === assessmentQuestions.length - 1 || !answers[currentQuestionIndex]}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>

        {isAssessmentComplete && (
          <div className="space-y-4 pt-4 border-t">
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertTitle>Next Steps</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Raise a promise in the system to arrange the Pre-Payment Meter installation.</li>
                  <li>Inform the customer the initial Debt Recovery Rate (DRR) will be set to £5.</li>
                  <li>Record the promise number below.</li>
                </ul>
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="promiseNumber">Promise Number</Label>
              <Input 
                id="promiseNumber" 
                placeholder="Enter promise number..."
                value={promiseNumber}
                onChange={(e) => setPromiseNumber(e.target.value)}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
